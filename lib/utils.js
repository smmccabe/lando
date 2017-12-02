/**
 * Contains utility functions.
 *
 * @since 3.0.0
 * @module utils
 * @example
 *
 * // Take an object and write a docker compose file
 * var filename = lando.utils.compose(filename, data);
 *
 * // Scan URLs and print results
 * return lando.utils.scanUrls(urls)
 * .then(function(results) {
 *   console.log(results);
 * });
 */

'use strict';

// Modules
var _ = require('./node')._;
var config = require('./config');
var engine = require('./engine');
var log = require('./logger');
var Promise = require('./promise');
var rest = require('./node').rest;
var yaml = require('./yaml');
var fs = require('./node').fs;
var path = require('path');



/**
 * Translate a name for use by docker-compose eg strip `-` and `.` and
 * @TODO: possibly more than that
 *
 * @since 3.0.0
 */
exports.dockerComposify = function(data) {
  return data.replace(/-/g, '').replace(/\./g, '');
};

/**
 * Used with _.mergeWith to concat arrays
 *
 * @since 3.0.0
 * @example
 *
 * // Take an object and write a docker compose file
 * var newObject = _.mergeWith(a, b, lando.utils.merger);
 */
exports.merger = function(objValue, srcValue) {
  if (_.isArray(objValue)) {
    return objValue.concat(srcValue);
  }
};

/**
 * Writes a docker compose object to a file.
 *
 * @since 3.0.0
 * @param {String} file - The absolute path to the destination file.
 * @param {Object} data - The data to write to the file.
 * @returns {String} The absolute path to the destination file.
 * @example
 *
 * // Take an object and write a docker compose file
 * var filename = lando.utils.compose(filename, data);
 */
exports.compose = function(file, data) {

  // Do the dump
  yaml.dump(file, data);

  // Log
  var services = _.keys(data);
  log.verbose('Building compose file at %s with services.', file, services);
  log.verbose('Writing %j to %s', services, file);
  log.debug('Full services for %s', file, data);

  // Return the filename
  return file;

};

/**
 * Scans URLs to determine if they are up or down.
 *
 * @since 3.0.0
 * @param {Array} urls - An array of urls like `https://mysite.lndo.site` or `https://localhost:34223`
 * @param {Object} [opts] - Options to configure the scan.
 * @param {Integer} [opts.max=7] - The amount of times to retry accessing each URL.
 * @param {Array} [opts.waitCode=[400, 502] - The HTTP codes to prompt a retry.
 * @returns {Array} An array of objects of the form {url: url, status: true|false}
 * @example
 *
 * // Scan URLs and print results
 * return lando.utils.scanUrls(['http://localhost', 'https://localhost'])
 * .then(function(results) {
 *   console.log(results);
 * });
 */
exports.scanUrls = function(urls, opts) {

  // Scan opts
  opts = {
    max: opts.max || 7,
    waitCodes: opts.waitCodes || [400, 502, 404]
  };

  // Log
  log.debug('Starting url scan with opts', opts);

  // Ping the sites for awhile to determine if they are g2g
  return Promise.map(urls, function(url) {

    // Do a reasonable amount of retries
    return Promise.retry(function() {

      // Log the attempt
      log.info('Checking to see if %s is ready.', url);

      // Send REST request.
      return new Promise(function(fulfill, reject) {

        // Make the actual request, lets make sure self-signed certs are OK
        rest.get(url, {rejectUnauthorized: false, followRedirects: false})

        // The URL is accesible
          .on('success', function() {
            log.verbose('%s is now ready.', url);
            fulfill({url: url, status: true});
          })

          // Throw an error on fail/error
          .on('fail', function(data, response) {

            // Get the code
            var code = response.statusCode;

            // If we have a wait code try again
            if (_.includes(opts.waitCodes, code)) {
              log.debug('%s not yet ready with code %s.', url, code);
              reject({url: url, status: false});
            }

            // If we have another code then we assume thing are ok
            else {
              log.debug('%s is now ready.', url);
              fulfill({url: url, status: true});
            }

          })

          // Something else bad happened
          .on('error', reject);

      });

    }, {max: opts.max})

    // Catch any error and return an inaccesible url
      .catch(function(err) {
        log.verbose('%s is not accessible', url);
        log.debug('%s not accessible with error', url, err.message);
        return {url: url, status: false};
      });

  })

  // Log and then return scan results
    .then(function(results) {
      log.debug('URL scan results', results);
      return results;
    });

};

/*
 * Helper to start util service
 */
exports.utilService = function(name, app) {
  // Fixed location of our util service compose file
  var utilDir = path.join(config.userConfRoot, 'util');
  var utilFile = path.join(utilDir, 'util.yml');
  // Let's get a service container
  var util = {
    image: 'devwithlando/util:stable',
    environment: {
      LANDO: 'ON',
      LANDO_HOST_OS: config.os.platform,
      LANDO_HOST_UID: config.engineId,
      LANDO_HOST_GID: config.engineGid,
      LANDO_HOST_IP: config.env.LANDO_ENGINE_REMOTE_IP,
      LANDO_WEBROOT_USER: 'www-data',
      LANDO_WEBROOT_GROUP: 'www-data',
      LANDO_WEBROOT_UID: '33',
      LANDO_WEBROOT_GID: '33',
      LANDO_MOUNT: '/app',
      COLUMNS: 256,
      TERM: 'xterm'
    },
    command: ['tail', '-f', '/dev/null'],
    entrypoint: '/lando-entrypoint.sh',
    labels: {
      'io.lando.container': 'TRUE',
      'io.lando.service-container': 'TRUE'
    },
    volumes: [
      '$LANDO_ENGINE_SCRIPTS_DIR/lando-entrypoint.sh:/lando-entrypoint.sh',
      '$LANDO_ENGINE_SCRIPTS_DIR/user-perms.sh:/user-perms.sh',
      '$LANDO_ENGINE_SCRIPTS_DIR/load-keys.sh:/load-keys.sh',
      '$LANDO_HOST_SSL_DIR/:/ssl',
    ]
  };

  // Set up our scripts
  // @todo: get volumes above into this
  var scripts = ['lando-entrypoint.sh', 'user-perms.sh', 'load-keys.sh'];
  _.forEach(scripts, function(script) {
    fs.chmodSync(path.join(config.engineScriptsDir, script), '755');
  });

  // Add important ref points
  var shareMode = (config.platform === 'darwin') ? ':delegated' : '';
  // @todo figure this out, why does it fail?
  // util.volumes.push(app + ':/app' + shareMode);
  util.volumes.push('$LANDO_ENGINE_HOME:/user' + shareMode);

  // Build and export compose
  var service = {
    version: '3.2',
    services: {
      util: util
    }
  };

  // Log
  log.debug('Run util service %j', service);
  this.compose(utilFile, service);

  // Name the project
  var project = 'landoutil' + name;

  // Try to start the util
  return {
    project: project,
    compose: [utilFile],
    container: [this.dockerComposify(project), 'util', '1'].join('_'),
    opts: {
      services: ['util']
    }
  };

};

/**
 * Run a command in util container
 */
exports.runUtil = function(name, app, cmd, user) {

  // Get the service
  var service = this.utilService(name, app);

  // Build out our run
  var run = {
    id: service.container,
    compose: service.compose,
    project: service.project,
    cmd: cmd,
    opts: {
      mode: 'attach',
      user: user || 'www-data',
      services: service.opts.services || ['util']
    }
  };

  // Start the container
  return engine.start(service)

  // On linux lets provide a little delay to make sure our user is set up
    .then(function() {
      if (config.platform === 'linux') {
        return Promise.delay(1000);
      }
    })

    // Exec
    .then(function() {
      return engine.run(run);
    });

};

/*
 * Helper to kill any running util processes
 */
exports.killUtil = function(name, app) {

  // Get the service
  var service = this.utilService(name, app);

  // Check if we have a container
  return engine.exists(service)

  // Killing in the name of
    .then(function(exists) {
      if (exists) {
        return engine.stop(service)
          .then(function() {
            return engine.destroy(service);
          });
      }
    });

};

