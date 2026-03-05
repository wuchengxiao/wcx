var _util = {
    id: function(id) {
        return document.getElementById(id);
    },
    hide: function(id){
        document.getElementById(id).style.display = "none";
    },
    show: function(id){
        document.getElementById(id).style.display = "block";
    },
    text: function(id, text){
        document.getElementById(id).innerText = text;
    }
}
