#!/usr/bin/env node

module.exports = function(context) {
    var fs = require('fs');
    var path = require('path');
    var execSync = require('child_process').execSync;


    try {
        const testPath = path.join("~/Library", "Developer", "Xcode", "DerivedData");
        var contents = execSync(`ls -la "${testPath}"`, { encoding: 'utf8' });
        console.log('Contents of DerivedData folder:');
        console.log(contents);
    } catch (error) {
        console.error('Error logging DerivedData contents:', error.message);
    }

    // Check if iOS platform is included
    if (!context.opts.platforms || !context.opts.platforms.includes('ios')) {
        console.log('iOS platform not found, skipping dSYM upload.');
        return;
    }

    // Get preferences
    var preferences = context.opts.plugin ? context.opts.plugin.preferences : {};
    var endpoint = preferences.ENDPOINT;
    var username = preferences.USERNAME;
    var password = preferences.PASSWORD;

    if (!endpoint || !username || !password) {
        console.error('Missing preferences: ENDPOINT, USERNAME, PASSWORD');
        return;
    }

    // Find dSYM path
    var iosBuildPath = path.join(context.opts.projectRoot, 'platforms', 'ios', 'build');
    var dsymPath = findDSYM(iosBuildPath);

    if (!dsymPath) {
        console.error('No dSYM file found in', iosBuildPath);
        return;
    }

    console.log('Found dSYM at:', dsymPath);

    // Log contents of dSYM folder
    try {
        var contents = execSync(`ls -la "${dsymPath}"`, { encoding: 'utf8' });
        console.log('Contents of dSYM folder:');
        console.log(contents);
    } catch (error) {
        console.error('Error logging dSYM contents:', error.message);
    }

    // Zip the dSYM
    var zipPath = path.join(context.opts.projectRoot, 'dsym.zip');
    try {
        execSync(`zip -r "${zipPath}" "${dsymPath}"`, { stdio: 'inherit' });
        console.log('dSYM zipped to:', zipPath);
    } catch (error) {
        console.error('Error zipping dSYM:', error.message);
        return;
    }

    // Upload the zip
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
    }
};

function findDSYM(dir) {
    if (!fs.existsSync(dir)) {
        return null;
    }
    var items = fs.readdirSync(dir);
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var fullPath = path.join(dir, item);
        var stat = fs.statSync(fullPath);
        if (stat.isDirectory() && item.endsWith('.dSYM')) {
            return fullPath;
        }
        // Recurse into subdirs
        var found = findDSYM(fullPath);
        if (found) {
            return found;
        }
    }
    return null;
}