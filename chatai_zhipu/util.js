var _util = {
    bodyAc: function(child){
        document.body.appendChild(child);
    },
    bodyRc: function(child){
        if (child) {
            document.body.removeChild(child);
        }
    },
    rc: function(parent, child){
        if (parent && child) {
            parent.removeChild(child);
        }
    },
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
    },
    ce: function(tag){
        return document.createElement(tag);
    },
    qa: function(selector){
        return document.querySelectorAll(selector);
    },
    ac: function(parent, child){
        parent.appendChild(child);
    },
    on: function(element, event, handler){
        element.addEventListener(event, handler);
    }
}
