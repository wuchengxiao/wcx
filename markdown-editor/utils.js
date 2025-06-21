(function(content){
    content.utils = {
        _id: id=>document.getElementById(id),
        _query: str=>document.querySelector(str),
        _style: (node,styleName,styleValue)=>{
            if(styleValue != undefined){
                node.style[styleName] = styleValue;
            }else{
                return node.style[styleName];
            }
        }
    }
})(this);