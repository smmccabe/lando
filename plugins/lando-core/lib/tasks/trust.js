/**
* Command to generate and trust a root certificate
*
* @name config
*/

'use strict';

module.exports = function(lando) {
  return {
    command: 'trust',
    describe: 'Install and trust a root certificate',
    run: function() {
      //    Generate Cert
      lando.certs.createRootCertificate()
      .then(function (result) {
        var trustCommand = lando.certs.trustRootCertCommand(lando.config.os.platform);
        console.log(lando.node.chalk.blue('We\'re about to run: \n\n' + lando.node.chalk.green(trustCommand.join(' ')) + '\n\nwhich will require your password. \n\nThis command will add our root certificate to your trusted certificate stores to avoid certificate warnings when using HTTPS on Lando apps.'))
        return lando.shell.sh(trustCommand, {mode: 'attach'})
          .then( function (value) {
            return console.log(lando.node.chalk.green('Aww, we trust you too!'));
          });
      });
    }
  };

};
