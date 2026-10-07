<?php
require_once("config.php");

function newest_file() {
    $max=0;    
    foreach (glob(TIMELINE_DIR."/*.jsonl") as $f) {
        if (preg_match('/([0-9]+).jsonl$/',$f, $m)) {
            if ($m[0]>$max)$max=$m[1];
        }

    }
    if ($max==0) return null;
    return TIMELINE_DIR."/$max.jsonl";
}
function add_timeline($tl){
    newest_file();
    

}
function get_timeline($params) {
    $limit=50;
    $before=isset($params["before"]) ? $params["before"] : null;
    $after=isset($params["after"]) ? $params["after"] : null;

}