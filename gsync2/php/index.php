<?php
require_once "ErrorHandler.php";
require_once 'utils.php';
require_once 'log.php';
require_once "config.php";
header("Content-Type: application/json");
if (defined("ALLOW_ORIGIN")){
    header("Access-Control-Allow-Origin: ".ALLOW_ORIGIN);
}
$method = $_SERVER['REQUEST_METHOD'];
$path = $_GET['action'] ?? '';

switch ($path) {
    case 'create':
        respond_with_log([], ['repo_id' => createRepo()]);
        break;

    case 'upload':
        $input = parseJson(file_get_contents('php://input'));
        respond_with_log($input, ['timestamp' => uploadObjects($input)]);
        break;

    case 'download':
        $input = parseJson(file_get_contents('php://input'));
        respond_with_log($input, downloadObjects($input["hash_list"]));
        break;

    case 'commit':
        /*{
        "hash": "...",
        "time": 1770000000,
        "public_key": "...",
        "signature": "..."
        }*/
        $input = parseJson(file_get_contents('php://input'));
        $data=[];
        foreach (["hash","public_key","signature"] as $attr) {
            $data[$attr]=$input[$attr];
        }
        $data["time"]=time();
        add_timeline($data);
        respond_with_log($input, ['status' => "ok", "time"=>$data["time"]]);
        break;
    case 'timeline':
        $input = parseJson(file_get_contents('php://input'));
        /*
        limit, before: hash,  after: hash, 
        */
        respond_with_log($input, ['timeline' => get_timeline($input)]);
        

    default:
        http_response_code(400);
        respond_with_log([], ['error' => 'Invalid action']);
}
