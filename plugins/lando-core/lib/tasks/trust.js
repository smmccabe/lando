/**
* Command to generate and trust a root certificate
*
* @name config
*/

'use strict';

var certs = require('../certs');
module.exports = function(lando) {

  // Define our task
  return {
    command: 'trust',
    describe: 'Install and trust a root certificate',
    run: function() {
      //    Generate Cert
      var certPath = certs.createCertificate(lando.config.userConfRoot);
      //    Trust Cert
      lando.shell.sh(certs.trustCertCommand(lando.config.os.platform, certPath));
    }
  };

};
