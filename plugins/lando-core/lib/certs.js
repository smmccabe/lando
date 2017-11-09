/**
* Basic certificate handling.
*/
'use strict';

var util = require('util');
var pem = require('pem');

module.exports = function(lando) {

  /**
   * Builds a command to trust a root certificate on host OS.
   *
   * @return string          OS specific shell command.
   * @param platform
   * @param certPath
   */
  var trustCertCommand = function (platform, certPath) {
    switch (platform) {
      case 'darwin':
        return util.format('security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain %s', certPath);
      case 'linux':
        // @todo implement Linux logic.
        return util.format('echo Linux is not yet supported for trusting certs.');
      case 'win32':
        // @todo implement Windows logic.
        return util.format('echo Windows is not yet supported for trusting certs.');
    }
  };

  /**
   * Create SSL certificate and copy to host.
   *
   * @param  string confRoot Path to copy certificate to on host.
   *
   * @return string path to certificate file on host.
   */
  var createCertificate = function (confRoot) {
    // Generate key in container
    var keyCmd = 'openssl genrsa -out /root/landoCA.key 2048'
    lando.utils.runUtil('ssl', 'lando', keyCmd, 'root');
    // Generate cert in container
    var certCmd = 'openssl req -x509 -new -nodes -key /root/landoCA.key -days 7300 -out /root/landoCA.pem'
    lando.utils.runUtil('ssl', 'lando', certCmd, 'root');
    // Copy certificate to host path
    return path.join([confRoot, 'ssl/landoCA.pem']);
  }


}
