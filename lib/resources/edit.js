module.exports = function(shell, resourceName){
  shell.registerResource(resourceName, function(resource, name, opts){  
    resource.add = function(line){
      this.step("cp "+name+" "+name+".bak"+(new Date().getTime())+" && echo '"+line+"' >> "+name)
        .check("cat "+name+" | grep '"+line+"' | wc -l", "-eq", 1);

      return this;
    };
    resource.remove = function(line){
      this.step("cp "+name+" "+name+".bak"+(new Date().getTime())+" && cat "+name+" | grep -v '"+line+"' > "+name+".tmp && mv "+name+".tmp "+name)
        .check("cat "+name+" | grep '"+line+"' | wc -l", "-eq", 0);

      return this;
    };
    resource.substitute = function(pattern, replacement){
      this.step("cp "+name+" "+name+".bak"+(new Date().getTime())+" && sed 's/"+pattern+"/"+replacement+"/g' -i "+name)
        .check("cat "+name+" | md5sum - | cut -f 1 -d ' '", "==", "\\$(cat "+name+" | sed 's/"+pattern+"/"+replacement+"/g' | md5sum - | cut -f 1 -d ' ')");

      return this;
    };
  });
};