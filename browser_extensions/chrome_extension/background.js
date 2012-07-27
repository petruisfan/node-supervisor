var socket = io.connect("http://localhost:7272");

watchedTabs = [];

// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};

// Keep the button up to date -------------------------------------------------
chrome.browserAction.onClicked.addListener(function(tab) {
    if (watchedTabs.indexOf(tab.id) >= 0) {
        chrome.browserAction.setIcon({path: "icon_blue.png"});
        watchedTabs.remove(watchedTabs.indexOf(tab.id));
    } else {
        chrome.browserAction.setIcon({path: "icon_orange.png"});
        watchedTabs.push(tab.id);
    }
});

chrome.tabs.onActivated.addListener(function(info) {
    if (watchedTabs.indexOf(info.tabId) >= 0) {
        chrome.browserAction.setIcon({path: "icon_orange.png"});
    } else {
        chrome.browserAction.setIcon({path: "icon_blue.png"});
    }
});
// ----------------------------------------------------------------------------

socket.on('reload', function (data) {
    for (tab in watchedTabs) {
        chrome.tabs.reload(watchedTabs[tab]);
    }
});