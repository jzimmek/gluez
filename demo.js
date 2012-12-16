var Shell = require("./lib/shell.js");

Shell.registerRecipe("commonDirs", function($, opts){
  $.dir("~/backup1--"+opts.bla);
  $.dir("~/backup2");

  var xxx = $.file("~/xxx.txt");

  return {
    notifies: function(resource){
      xxx.notifies(resource);
    },
    subscribes: function(resource){
      xxx.subscribes(resource);
    }
  };
});

new Shell(function($){
  var docs = $.dir("~/docs", {noop: true});
  var docs2 = $.dir("~/docs2");


  $.install("couchdb");

  $.transfer("/etc/aliases", {source: "bla"});

  // docs2.notifies(docs);

  var commonDir = $.recipe("commonDirs", {bla: "xxx"});

  commonDir.notifies(docs);

  // var readme = $.file("~/readme.txt");

  // var profileEdit = $.edit("~/.profile");

  // docs.notifies(readme);

  // var readme2 = $.file("~/readme2.txt");
  // readme2.subscribes(readme);

  // profileEdit.add("PATH=~/bin:\\$PATH");
  // profileEdit.remove("mesg n");

  // $.su(function($){
  //   $.file("~/bla.txt");
  //   $.recipe("commonDirs", {bla: "zzz"});
  // }, "jzk");

}).generate();