#!/usr/bin/env node

var path = require('path');
var xml2js = require('xml2js');
var fs = require('fs');
var execSync = require('child_process').execSync;
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
    var pluginVars = getPluginVars(context.opts.projectRoot, context.opts.plugin.id, [ 'ENABLED', 'BASEURL', 'USERNAME', 'PASSWORD']);
    var enabled = pluginVars.ENABLED;
    var baseUrl = pluginVars.BASEURL;
    var username = pluginVars.USERNAME;
    var password = pluginVars.PASSWORD;
    if (!enabled) {
        console.log('Plugin is disabled.');
        return;
    }
    if (!baseUrl || !username || !password) {
        console.error('Missing preferences: BASEURL, USERNAME, PASSWORD');
        return;
    }

    //Get app name from project config.xml
    var appName = getAppName(context.opts.projectRoot);

    // Find dSYM path
    var dsymPath = findDSYM(appName, context.opts.options && context.opts.options.debug);

    if (!dsymPath) {
        console.error('No dSYM file found in', dsymPath);
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
        baseUrl: baseUrl,
        username: username,
        password: password,
        appName: appName
    })
    .then(res => console.log(res))
    .catch(err => console.error(err));
};

/***
 * Find the dSYM file in the Xcode DerivedData directory
 * @returns {string|undefined} path to the dSYM file, or undefined if not found
 */
function findDSYM(appName, isDebug = true) {
    try {
        var username = execSync(`whoami`, { encoding: 'utf8' }).trim();

        const derivedData = path.join(path.sep, "Users", username, "Library", "Developer", "Xcode", "DerivedData");
        const projectNameStartsWith = appName;
        const match = fs.readdirSync(derivedData)
            .find(name => name.startsWith(projectNameStartsWith));
        
        if (!match) {
            return;
        }
        let iphoneOSFolder = "Release-iphoneos";
        if (isDebug) {
            iphoneOSFolder = "Debug-iphoneos";
        }
        dsymPath = path.join(derivedData, match, "Build", "Intermediates.noindex", "ArchiveIntermediates", projectNameStartsWith, "BuildProductsPath", iphoneOSFolder, projectNameStartsWith + ".app.dSYM");

        return dsymPath;
    } catch (error) {
        console.error('Error logging DerivedData contents:', error.message);
    }
}
/**
 * Get multiple variables for a Cordova plugin from package.json
 * @param {string} projectRoot - Cordova project root path
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

/**
 * Get app name from config.xml in a Cordova project
 * @param {string} projectRoot - Cordova project root path
 * @return {string} app name, or folder name if not found
 */
function getAppName(projectRoot) {
   var appName;
    try {
        var configXmlPath = path.join(projectRoot, 'config.xml');
        if (fs.existsSync(configXmlPath)) {
            var configXml = fs.readFileSync(configXmlPath, 'utf8');
            xml2js.parseString(configXml, (err, result) => {
                if (err) {
                    console.error('Error parsing config.xml:', err);
                    appName = path.basename(projectRoot);
                    return;
                }
                appName = result.widget.name[0]; // Adjust based on your XML structure
                console.log('App name from config.xml:', appName);
            });
        } else {
            console.warn('config.xml not found, using default app name.');
            appName = path.basename(projectRoot);
        }
    } catch (error) {
        console.error('Error reading config.xml:', error);
        appName = path.basename(projectRoot);
    }
    return appName;
}