<?php
require_once("config.php");

function getTime($f) {
    if (preg_match('/([0-9]+).jsonl$/',$f, $m)) {
        return $m[1];
    }
    return 0;
}
function all_files() {
    $files=[];
    foreach (glob(TIMELINE_DIR."/*.jsonl") as $f) {
        $files[]=$f;
    }
    usort($files,function ($a,$b) {
        return getTime($b)-getTime($a);
    });
    return $files;
}
function find($before, $after) {
    foreach (all_files() as $f) {
        if (getTime($f)>$before) {
            continue;
        }
        foreach(file($f) as $line) {
            $obj=json_decode($line);
            if ($obj && 
                $obj["time"]>=$after && $obj["time"]>=$before) {
                yield $obj;
            } 
        }
        if (getTime($f)<$after) {
            break;
        }
    }
}
function find_file($time) {
    $undef=-1;
    $max=$undef;   
    foreach (glob(TIMELINE_DIR."/*.jsonl") as $f) {
        if (preg_match('/([0-9]+).jsonl$/',$f, $m)) {
            if ($m[1]<=$time){
                if ($m[1]>$max)$max=$m[1];
            }
        }
    }
    $fn=TIMELINE_DIR."/$max.jsonl";
    return $fn;
}
function newest_file() {
    $undef=-1;
    $max=$undef;    
    foreach (glob(TIMELINE_DIR."/*.jsonl") as $f) {
        if (preg_match('/([0-9]+).jsonl$/',$f, $m)) {
            if ($m[1]>$max)$max=$m[1];
        }
    }
    $fsize=1000*1000;
    if (!defined("FILESIZE_PER_TIMELINE")) {
        $fsize=FILESIZE_PER_TIMELINE;
    }
    $fn=TIMELINE_DIR."/$max.jsonl";
    if (file_exists($fn) && filesize($fn)>$fsize) {
        $max=$undef;
    }
    if ($max===$undef) {
        $max=time();
        $fn=TIMELINE_DIR."/$max.jsonl";
    }
    return $fn;
}
function add_timeline($tl){
    $fn=newest_file();
    $fp=fopen($fn,"a");
    fwrite($fp, json_encode($tl)."\n");
    fclose($fp);
}

function get_timeline($params) {
    $limit=50;
    $before=isset($params["before"]) ? $params["before"] : null;
    $after=isset($params["after"]) ? $params["after"] : null;

}