/**
 * Basic certificate handling.
 */
'use strict';


module.exports = function(lando) {
  var util = require('util');
  var path = require('path');
  var fs = lando.node.fs;

  lando.config.env.LANDO_SSL_DIR = path.join(lando.config.userConfRoot, 'ssl');
  /**
   * Builds a command to trust a root certificate on host OS.
   *
   * @return string          OS specific shell command.
   * @param platform         OS platform according to Node runtime.
   */
  var trustRootCertCommand = function (platform) {

    switch (platform) {
      case 'darwin':
        return [
          'sudo',
          'security',
          'add-trusted-cert',
          '-d',
          '-r',
          'trustRoot',
          '-k',
          '/Library/Keychains/System.keychain', path.join(lando.config.env.LANDO_SSL_DIR, 'certs', 'landoCA.crt')
        ];
      case 'linux':
        // @todo implement Linux logic.
        return util.format('echo Linux is not yet supported for trusting certs.');
      case 'win32':
        // @todo implement Windows logic.
        return util.format('echo Windows is not yet supported for trusting certs.');
    }
  };

  /**
   * Create SSL certificate and share to host.
   *
   * @return array [certPath, keyPath].
   */
  var createRootCertificate = function () {

    // Some variables we'll need
    var sslConfig = path.join(__dirname, 'stubs');
    var copyOpts = {
      overwrite: true,
      filter: function(file) {
        return (path.extname(file) !== '.js');
      }
    };
    var sslDir = '/ssl'
    var keyPath = path.join(sslDir, 'landoCA.key');
    var csrPath = path.join(sslDir, 'landoCA.csr');
    var confPath = path.join(sslDir, 'ssl.conf');
    var crtPath = path.join(sslDir, 'certs', 'landoCA.crt')

    // Setup SSL directory and copy over the config stub.
    fs.mkdirpSync(path.join(lando.config.env.LANDO_SSL_DIR, 'certs'));
    fs.copySync(sslConfig, lando.config.env.LANDO_SSL_DIR, copyOpts);

    // ALLTHECOMMANDS!

    // private key
    var keyCmd = util.format('openssl genrsa -out %s 2048', keyPath);

    // signing request
    var csrCmd = util.format([
        'openssl',
        'req',
        '-new',
        '-key',
        '%s',
        '-out',
        '%s',
        '-subj',
        '"/C=US/ST=CA/O=Lando/localityName=San Francisco/commonName=*.lndo.site/organizationalUnitName=EngineRoom/emailAddress=no-reply@example.com/" -config %s -passin pass:',
      ].join(' '),
      keyPath, csrPath, confPath
    );

    // certificate
    var certCmd = util.format(
      'openssl x509 -req -sha256 -days 365 -in %s -signkey %s -out %s -extensions v3_req -extfile %s',
      csrPath, keyPath, crtPath, confPath
    );

    // Form blazing sword!
    var finalCmd = keyCmd + ' && ' + csrCmd + ' && ' + certCmd;

    // Generate key/cert in container
    return lando.utils.runUtil('ssl', 'lando', finalCmd, 'root');
  };

  var createServiceCertificate = function (app, service) {

  };

  return {
    createRootCertificate: createRootCertificate,
    trustRootCertCommand: trustRootCertCommand
  }
}
