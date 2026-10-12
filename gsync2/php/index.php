<?php
require_once "ErrorHandler.php";
require_once "config.php";
require_once 'utils.php';
require_once 'timeline.php';
require_once 'log.php';
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
/*
async function sendData() {
  let url = 'http://localhost/gsync2/?action=timeline'; 
  const time= (new Date().getTime())/1000;
  let data = { before: time, after: time-86400 };
  url = 'http://localhost/gsync2/?action=commit'; 
  data = {
    "hash": "12345",
    time,
    "public_key": "pub",
    "signature": "sig"
  };
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      // 1. サーバーからエラー内容（JSON）を読み取る
      const errorData = await response.json();   
      console.log(errorData);
      //throw new Error(errorData || `エラーが発生しました (Status: ${response.status})`);
    }
    const result = await response.json(); // サーバーからのレスポンスをJSONとして受け取る
    console.log('成功:', result);
  } catch (error) {
    console.error('失敗:', error);
  }
}
sendData();  
*/