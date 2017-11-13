/**
* Command to generate and trust a root certificate
*
* @name config
*/

'use strict';

module.exports = function(lando) {

  // Define our task
  return {
    command: 'trust',
    describe: 'Install and trust a root certificate',
    run: function() {
      //    Generate Cert
      lando.certs.createCertificate()
      .then(function (result) {
        var trustCommand = lando.certs.trustCertCommand(lando.config.os.platform);
        console.log(lando.node.chalk.blue('We\'re about to run: \n\n' + lando.node.chalk.green(trustCommand.join(' ')) + '\n\nwhich will require your password. \n\nThis command will add our root certificate to your trusted certificate stores to avoid certificate warnings when using HTTPS on Lando apps.'));
        lando.shell.sh(trustCommand, {mode: 'attach'});
      });
    }
  };

};
