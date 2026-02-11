#!/usr/bin/env node

var path = require('path');
var execSync = require('child_process').execSync;
var fs = require('fs');
var multipartUploadZip = require('./upload.js');

module.exports = async function(context) {

    // Check if iOS platform is included
    if (!context.opts.platforms || !context.opts.platforms.includes('ios')) {
        console.log('iOS platform not found, skipping dSYM upload.');
        return;
    }

    // Get preferences
    console.log('Retrieving plugin preferences...');
    console.log('Context:', context);
    var pluginVars = getPluginVars(context.opts.projectRoot, context.opts.plugin.id, ['ENDPOINT', 'USERNAME', 'PASSWORD']);
    var endpoint = pluginVars.ENDPOINT;
    var username = pluginVars.USERNAME;
    var password = pluginVars.PASSWORD;
    if (!endpoint || !username || !password) {
        console.error('Missing preferences: ENDPOINT, USERNAME, PASSWORD');
        return;
    }

    // Find dSYM path
    var dsymPath = findDSYM();

    if (!dsymPath) {
        console.error('No dSYM file found in', iosBuildPath);
        return;
    }

    console.log('Found dSYM at:', dsymPath);

    // Zip the dSYM
    var zipPath = path.join(context.opts.projectRoot, 'dsym.zip');
    try {
        execSync(`zip -r "${zipPath}" "${dsymPath}"`, { stdio: 'inherit' });
        console.log('dSYM zipped to:', zipPath);
    } catch (error) {
        console.error('Error zipping dSYM:', error.message);
        return;
    }

    await multipartUploadZip({
        filePath: zipPath,
        baseUrl: endpoint,
        username: username,
        password: password,
    })
    .then(res => console.log(res))
    .catch(err => console.error(err));

    /*// Upload the zip
    try {
        var uploadCommand = `curl -X POST -u "${username}:${password}" -F "file=@${zipPath}" "${endpoint}"`;
        var result = execSync(uploadCommand, { encoding: 'utf8' });
        console.log('Upload result:', result);
    } catch (error) {
        console.error('Error uploading dSYM:', error.message);
    } finally {
        // Clean up zip file
        if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath);
        }
    }*/
};

/***
 * Find the dSYM file in the Xcode DerivedData directory
 * @returns {string|undefined} path to the dSYM file, or undefined if not found
 */
function findDSYM() {
    try {
        var username = execSync(`whoami`, { encoding: 'utf8' }).trim();

        const derivedData = path.join("/Users",username, "Library", "Developer", "Xcode", "DerivedData");
        const projectNameStartsWith = 'MABSDebugSymbolsPluginSample';
        const match = fs.readdirSync(derivedData)
            .find(name => name.startsWith(projectNameStartsWith));
        
        if (!match) {
            return;
        }

        dsymPath = path.join(derivedData, match, "Build", "Intermediates.noindex","ArchiveIntermediates", projectNameStartsWith, "BuildProductsPath", "Debug-iphoneos", projectNameStartsWith + ".app.dSYM");

        return dsymPath;
    } catch (error) {
        console.error('Error logging DerivedData contents:', error.message);
    }
}
/**
 * Get multiple variables for a Cordova plugin from package.json
 * @param {object} context - Cordova hook context
 * @param {string} pluginId - plugin id (e.g. "my-plugin")
 * @param {string[]} varNames - array of variable names to read
 * @returns {object} key/value map of variables found
 */
function getPluginVars(projectRoot, pluginId, varNames) {
  const pkgPath = path.join(projectRoot, "package.json");

  if (!fs.existsSync(pkgPath)) return {};

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  const pluginVars = pkg?.cordova?.plugins?.[pluginId];
  if (!pluginVars) return {};

  const result = {};

  for (const name of varNames) {
    if (pluginVars[name] !== undefined) {
      result[name] = pluginVars[name];
    }
  }

  return result;
}