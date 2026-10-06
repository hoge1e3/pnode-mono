<?php

require_once "config.php";
require_once 'log.php';
function initStorage() {
    $repo_path=REPO_DIR;
    mkdir("$repo_path/objects", 0777, true);
    mkdir("$repo_path/refs/heads", 0777, true);
    $timeline_path=TIMELINE_DIR;
    mkdir("$timeline_path", 0777, true);

}
initStorage();

function uploadObjects(array $data): string {
    
    $objects = $data['objects'];
    
    $repo_path = REPO_DIR . "/objects";
    if (!is_dir($repo_path)) {
        http_response_code(404);
        exit(json_encode(['error' => 'Repo not found']));
    }

    $now = time();

    foreach ($objects as $obj) {
        $hash = $obj['hash'];
        $content = $obj['content'];

        $dir = substr($hash, 0, 2);
        $file = substr($hash, 2);

        $object_dir = "$repo_path/$dir";
        $object_path = "$object_dir/$file";

        if (!is_dir($object_dir)) {
            mkdir($object_dir, 0777, true);
        }

        if (!file_exists($object_path)) {
            $binary = base64_decode($content);                  
            file_put_contents($object_path, $binary);
            touch($object_path, $now);
        }
    }

    return $now;
}
function downloadObjects( array $hash_list): array {
    $repo_path = REPO_DIR . "/objects";

    if (!is_dir($repo_path)) {
        http_response_code(404);
        exit(json_encode(['error' => 'Repo $repo_id not found']));
    }

    $result = [];
    foreach ($hash_list as $hash) {
        $dir = substr($hash, 0, 2);
        $file = substr($hash, 2);
        $full = "$repo_path/$dir/$file";
        if (!file_exists($full)) continue;
        $binary = file_get_contents($full);
        $base64 = base64_encode($binary);
        $result[] = [
            'hash' => $hash,
            'content' => $base64,
        ];
    }

    return ["objects"=>$result];
}

function parseJson($str) {
    if (strlen($str)===0) {
        throw new Exception("Empty json");
    } 
    $r=json_decode($str, true);
    if ($r===null) {
        throw new Exception("Cannot parse json: $str");
    }
    return $r;
}
$exclude_attributes=["objects"];
//$logging_attributes=["repo_id", "branch", "current", "next", "since"];
function respond_with_log($input, $response) {
    logMessage([
        "input" => create_log_entry($input),
        "response" => create_log_entry($response)
    ]);

    echo json_encode($response);
    exit;
}
function create_log_entry($input) {
    global $exclude_attributes;
    $log_entry = [];
    foreach ($input as $attr => $value) {
        if (!in_array($attr, $exclude_attributes) && isset($input[$attr])) {
            $log_entry[$attr] = $input[$attr];
        }
    }
    return $log_entry;
}
