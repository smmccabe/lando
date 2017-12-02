/**
 * Basic certificate handling.
 */
'use strict';


module.exports = function(lando) {
  // constants
  lando.config.env.LANDO_HOST_SSL_DIR = path.join(lando.config.userConfRoot, 'ssl');
  const SSL_DIR = "/ssl";
  const ROOT_CERT_PATH = path.join(SSL_DIR, 'certs', 'landoCA.crt');
  const HOST_ROOT_CERT_PATH = path.join(lando.config.env.LANDO_HOST_SSL_DIR, 'certs', 'lando')
  const ROOT_KEY_PATH = path.join(SSL_DIR, 'landoCA.key');
  const ROOT_CSR_PATH = path.join(SSL_DIR, 'landoCA.csr');
  const CONF_PATH = path.join(SSL_DIR, 'ssl.conf');

  // modules
  const util = require('util');
  const path = require('path');
  const fs = lando.node.fs;


  /**
   * Builds a command to trust a root certificate on host OS.
   *
   * @return string          OS specific shell command.
   * @param platform         OS platform according to Node runtime.
   */
  let trustRootCertCommand = function (platform) {

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
          '/Library/Keychains/System.keychain', path.join(lando.config.env.LANDO_HOST_SSL_DIR, 'certs', 'landoCA.crt')
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
  let createRootCertificate = function() {

    // Some variables we'll need
    var sslConfig = path.join(__dirname, 'stubs');
    var copyOpts = {
      overwrite: true,
      filter: function(file) {
        return (path.extname(file) !== '.js');
      }
    };


    // Setup SSL directory and copy over the config stub.
    fs.mkdirpSync(path.join(lando.config.env.LANDO_HOST_SSL_DIR, 'certs'));
    fs.copySync(sslConfig, lando.config.env.LANDO_HOST_SSL_DIR, copyOpts);

    if (rootCertExists()) {
      return [
        getRootCert(),
        getRootKey()
      ]
    }

    // ALLTHECOMMANDS!

    // private key
    var keyCmd = util.format('openssl genrsa -out %s 2048', ROOT_KEY_PATH);

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
        '"/C=US/ST=CA/O=Lando/localityName=San Francisco/commonName=*.%s/organizationalUnitName=EngineRoom/emailAddress=no-reply@example.com/" -config %s -passin pass:',
      ].join(' '),
      ROOT_KEY_PATH, ROOT_CSR_PATH, lando.config.proxyDomain, CONF_PATH
    );

    // certificate
    var certCmd = util.format(
      'openssl x509 -req -sha256 -days 365 -in %s -signkey %s -out %s -extensions v3_req -extfile %s',
      ROOT_CSR_PATH, ROOT_KEY_PATH, ROOT_CERT_PATH, CONF_PATH
    );

    // Form blazing sword!
    var finalCmd = keyCmd + ' && ' + csrCmd + ' && ' + certCmd;

    // Generate key/cert in container
    return lando.utils.runUtil('ssl', 'lando', finalCmd, 'root');
  };

  let createProxyCertificate = function(proxy) {
    if (!rootCertExists()) {
      createRootCertificate();
    }
    let keyPath = path.join(SSL_DIR, 'certs', 'landoProxy.key');
    let csrPath = path.join(SSL_DIR, 'landoProxy.csr');
    let confPath = path.join(SSL_DIR, 'ssl.conf');
    let crtPath = path.join(SSL_DIR, 'certs', 'landoProxy.crt');
    let rootCACertPath = path.join(SSL_DIR, 'certs', 'landoCA.crt')
    let rootCAKeyPath = path.join(SSL_DIR, 'landoCA.key')
    // private key
    let keyCmd = util.format('openssl genrsa -out %s 2048', keyPath);

    // signing request
    let csrCmd = util.format([
        'openssl',
        'req',
        '-new',
        '-key',
        '%s',
        '-out',
        '%s',
        '-subj',
        '"/C=US/ST=CA/O=Lando/localityName=San Francisco/commonName=*.%s/organizationalUnitName=EngineRoom/emailAddress=no-reply@example.com/" -config %s -passin pass:',
      ].join(' '),
      keyPath, csrPath, lando.config.proxyDomain, confPath
    );

    let certCmd = util.format(
      'openssl x509 -req -sha256 -days 365 -in %s -signkey %s -CA %s -CAkey %s -CAcreateserial -out %s -extensions v3_req -extfile %s',
      csrPath, keyPath, rootCACertPath, rootCAKeyPath, crtPath, confPath
    );

    // Form blazing sword!
    let finalCmd = keyCmd + ' && ' + csrCmd + ' && ' + certCmd;

    // Generate key/cert in container
    return lando.utils.runUtil('ssl', 'lando', finalCmd, 'root');
  }

  let rootCertExists = function() {
    return fs.exists(
      path.join(
        lando.config.env.LANDO_HOST_SSL_DIR,
        'certs',
        'landoCA.crt'
      );
  }

  let getRootCert = function(){
    return path.join(lando.config.env.LANDO_HOST_SSL_DIR, 'certs', 'landoCA.crt')
  }

  return {
    createProxyCertificate: createProxyCertificate,
    createRootCertificate: createRootCertificate,
    trustRootCertCommand: trustRootCertCommand,
  }
}
