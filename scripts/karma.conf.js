const generate = require('videojs-generate-karma-config');

module.exports = function(config) {

  const options = {
    browsers(aboutToRun) {
      return aboutToRun.filter(function(launcherName) {
        return !(/^(Safari|Chromium)/).test(launcherName);
      });
    }
  };

  config = generate(config, options);

  // any other custom stuff not supported by options here!
};
