'use strict';

const forge = require('node-forge');
const fs = require('fs');

exports.createCA = (certPath = '/certs/lando.pem', keyPath = '/certs/lando.key') => {
    let pki = forge.pki;
    let caKeys;

    // generate a keypair and create an X.509v3 certificate
    if (fs.existsSync(keyPath)) {
        caKeys = pki.privateKeyFromPem(fs.readFileSync(keyPath));
    } else {
        caKeys = pki.rsa.generateKeyPair(2048);
    }

    if (fs.existsSync(certPath)) {
        return;
    }

    let caCert = pki.createCertificate();
    caCert.publicKey = caKeys.publicKey;

    // NOTE: serialNumber is the hex encoded value of an ASN.1 INTEGER.
    // Conforming CAs should ensure serialNumber is:
    // - no more than 20 octets
    // - non-negative (prefix a '00' if your value starts with a '1' bit)
    caCert.serialNumber = '01';
    caCert.validity.notBefore = new Date();
    caCert.validity.notAfter = new Date();
    caCert.validity.notAfter.setFullYear(caCert.validity.notBefore.getFullYear() + 3);

    let attrs = [{
            shortName: 'CN',
            value: 'Lando CA Cert',
        }, {
            shortName: 'C',
            value: 'US',
        }, {
            shortName: 'ST',
            value: 'California',
        }, {
            shortName: 'L',
            value: 'San Francisco',
        }, {
            shortName: 'O',
            value: 'Lando',
        }, {
            shortName: 'OU',
            value: 'Bespin',
    }];

    caCert.setSubject(attrs);

    fs.writeFileSync(certPath, pki.certificateToPem(caCert));
    fs.writeFileSync(keyPath, pki.privateKeyToPem(caKeys));
};

/*
# Let 's log some helpful things
echo "Looks like you do not have a Lando CA yet! Let's set one up!"
echo "Trying to setup root CA with..."
echo "LANDO_CA_CERT: $LANDO_CA_CERT"
echo "LANDO_CA_KEY: $LANDO_CA_KEY"

# Set get the key ready
if [!-f "$LANDO_CA_KEY"];
then
echo "$LANDO_CA_CERT not found... generating one"
openssl genrsa - out $LANDO_CA_KEY 2048
fi

# Set up a CA
for lando things
if [!-f "$LANDO_CA_CERT"];
then

# Log
echo "$LANDO_CA_CERT not found... generating one"

# log
echo "CA generated at $LANDO_CA_CERT"

fi

*/

exports.createCert = (certPath, keyPath, aliases, caCertPath = '/certs/lando.pem', caKeyPath = '/certs/lando.key') => {
    let pki = forge.pki;

    let caCertPem = fs.readFileSync(caCertPath);
    let caKeysPem = fs.readFileSync(caKeysPath);
    let caCert = pki.certificateFromPem(caCertPem);
    let caKeys = pki.privateKeyFromPem(caKeysPem);
    let keys;

    // generate a keypair and create an X.509v3 certificate
    // generate a keypair and create an X.509v3 certificate
    if (fs.existsSync(keyPath)) {
        keys = pki.privateKeyFromPem(fs.readFileSync(keyPath));
    }
    else {
        keys = pki.rsa.generateKeyPair(2048);
    }

    if (fs.existsSync(certPath)) {
        // This seems overly complex but the documentation is unclear.
        let cert = pki.certificateFromPem(fs.readFileSync(certPath));
        let caStore = pki.createCaStore([caCertPem]);
        let issuer = caStore.getIssuer(cert);

        if (issuer.verify(cert)) {
            return;
        }
    }

    let cert = pki.createCertificate();
    cert.publicKey = keys.publicKey;

    // NOTE: serialNumber is the hex encoded value of an ASN.1 INTEGER.
    // Conforming CAs should ensure serialNumber is:
    // - no more than 20 octets
    // - non-negative (prefix a '00' if your value starts with a '1' bit)
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 3);

    let attrs = [{
        shortName: 'CN',
        value: 'Lando CA Cert',
    }, {
        shortName: 'C',
        value: 'US',
    }, {
        shortName: 'ST',
        value: 'California',
    }, {
        shortName: 'L',
        value: 'San Francisco',
    }, {
        shortName: 'O',
        value: 'Lando',
    }, {
        shortName: 'OU',
        value: 'Bespin',
    }];

    cert.setSubject(attrs);
    cert.setIssuer(caCert);

    altNames = [];
    for (const alias of aliases) {
        altName.push({type: 6, value: alias});
    }

    cert.setExtensions([{
        name: 'subjectAltName',
        altNames: altNames,
    }]);

    cert.sign(caKeys);

    fs.writeFileSync(certPath, pki.certificateToPem(cert));
    fs.writeFileSync(keyPath, pki.privateKeyToPem(keys));
};

/*
: ${LANDO_DOMAIN:="lndo.site"}
: ${LANDO_CA_CERT:="/lando/certs/lando.pem"}
: ${LANDO_CA_KEY:="/lando/certs/lando.key"}
: ${CA_DIR:="/usr/share/ca-certificates"}
# need a basename
: ${CA_CERT_FILENAME:="lando.pem"}
: ${CA_CERT_CONTAINER:="$CA_DIR/$CA_CERT_FILENAME"}

# Make sure our cert directories exists
mkdir -p /certs $CA_DIR
*/

exports.trustCert = (certPath, certDestination) => {
    fs.copyFile(certPath, certDestination);
    fs.appendFileSync('/etc/ca-certificates.conf', certDestination);
};
