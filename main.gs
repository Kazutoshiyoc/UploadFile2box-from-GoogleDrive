// ==================================================================================================
//
//    環境変数の読み込み ＆ define
//
// ==================================================================================================
// BoxAppの認証情報
const BOX_CLIENT_ID     = PropertiesService.getScriptProperties().getProperty("BOX_CLIENT_ID");
const BOX_CLIENT_SECRET = PropertiesService.getScriptProperties().getProperty("BOX_CLIENT_SECRET");
const BOX_ENTERPRISE_ID = PropertiesService.getScriptProperties().getProperty("BOX_ENTERPRISE_ID");
const BOX_USER_ID       = PropertiesService.getScriptProperties().getProperty("BOX_USER_ID");

// Boxアップロード先の親ディレクトリID
const BOX_PARENT_DIR_ID = PropertiesService.getScriptProperties().getProperty("BOX_PARENT_DIR_ID");

// 操作対象のGoogleDriveファイルID
const DRIVE_FILE_ID = PropertiesService.getScriptProperties().getProperty("DRIVE_FILE_ID");

// ----------------------------------------------------------------
// デバッグ用認証情報
const TEST_BOX_ACCESS_TOKEN = "";

// APIのURLを定義
const BOX_REQUEST_TOKEN_POST_URL                = "https://api.box.com/oauth2/token";
const BOX_FILES_UPLOAD_POST_URL                 = "https://upload.box.com/api/2.0/files/content";
const BOX_FILES_UPLOAD_VERSION_POST_URL__PREFIX = "https://upload.box.com/api/2.0/files/";
const BOX_FILES_UPLOAD_VERSION_POST_URL__SUFFIX = "/content";



// ==================================================================================================
//
//    box API : Authorization
//
// ==================================================================================================

// ----------------------------------------------------------------
// アクセストークンを取得する関数
// ----------------------------------------------------------------
function getAccessToken() {

  const parameters = {
    method: "POST",
    muteHttpExceptions: true,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    payload: {
      grant_type      : "client_credentials",
      client_id       : BOX_CLIENT_ID,
      client_secret   : BOX_CLIENT_SECRET,
      box_subject_type: "enterprise",
      box_subject_id  : BOX_ENTERPRISE_ID,
      //box_subject_type: "user",
      //box_subject_id  : BOX_USER_ID,
      scope           : "item_upload",
    },
  };
  const res = UrlFetchApp.fetch(BOX_REQUEST_TOKEN_POST_URL, parameters);
  console.log("res = " + res);

  const access_token = JSON.parse(res).access_token
  console.log("access_token: " + access_token);

  return access_token;
}



// ==================================================================================================
//
//    box API : Upload
//
// ==================================================================================================

// ----------------------------------------------------------------
// POSTパラメータを設定する関数
// ----------------------------------------------------------------
function setParametersBoxApiUploadFile(uploadFileName, boxParentId, uploadFileBlob, boxAccessToken) {
  // POSTパラメータの設定
  var uploadFileMetadata = {
    name: uploadFileName,
    parent: { id: boxParentId },
  };
  var parameters = {
    method: "POST",
    muteHttpExceptions: true,
    headers: {
      Authorization: "Bearer "+ boxAccessToken,
    },
    payload: {
      attributes: JSON.stringify(uploadFileMetadata),
      file: uploadFileBlob,
    },
  };

  return parameters;
}

// --------------------------------------------------------------------------------------
// boxの指定ディレクトリに新規ファイルをアップロードする関数
//  - Upload file: https://developer.box.com/reference/post-files-content/
// --------------------------------------------------------------------------------------
function upload2box(url, parameters) {
  // POST
  const res = UrlFetchApp.fetch(url, parameters);

  // 戻り値の表示
  console.log("Response: " + res.getResponseCode());
  console.log("res = " + res);

  return res;
}

// --------------------------------------------------------------------------------------
// boxの指定ディレクトリにファイルをアップロードして更新する関数
//  - Upload file version: https://developer.box.com/reference/post-files-id-content/
// --------------------------------------------------------------------------------------
function uploadVersion2box(url, parameters) {
  // POST
  const res = UrlFetchApp.fetch(url, parameters);

  // 戻り値の表示
  console.log("Response: " + res.getResponseCode());
  console.log("res = " + res);

  return res;
}



// ==================================================================================================
//
//    main関数
//
// ==================================================================================================
function main() {

  // ----------------------------------------------------------------
  //    Box API 関連の初期設定
  // ----------------------------------------------------------------
  // box APIのアクセストークンを取得
  //const boxAccessToken = getAccessToken();           
  const boxAccessToken = TEST_BOX_ACCESS_TOKEN;

  // --------------------------------------------------
  //
  // 【クライアント資格情報許可を使用したOAuth 2.0 (サーバー認証) の場合】
  //
  //  - box_subject_type: "enterprise" の場合  ->  {"error":"insufficient_scope","error_description":"Insufficient permissions for the requested scope."}
  //  - box_subject_type: "user"       の場合  ->  {"error":"invalid_grant","error_description":"Grant credentials are invalid"}
  //
  //  * スコープの問題のようなので、最も弱い権限でありそうな scope: "item_upload" を設定したが挙動に変化はなかった。
  //  - box_subject_type を指定しない場合       ->  {"error":"unauthorized_client","error_description":"The \"box_subject_type\" value is unauthorized for this client_id"}
  //
  // 結論：　多分、管理者からAppの承認を受けないと常用できない（参考: https://qiita.com/YKInoMT/items/c667ecc383a5ec536ddc ）
  //
  // --------------------------------------------------
  //
  // 【OAuth 2.0 (ユーザーまたはクライアント認証) の場合】
  //
  //  - box_subject_type: "enterprise" の場合  ->  {"error":"unauthorized_client","error_description":"The \"box_subject_type\" value is unauthorized for this client_id"}
  //  - box_subject_type: "user"       の場合  ->  {"error":"unauthorized_client","error_description":"The \"box_subject_type\" value is unauthorized for this client_id"}
  //  * このオプションはOAuth 2.0ではサポートしていないようだった。
  //
  //  - box_subject_type を指定しない場合       ->  {"access_token":"hogehogehogehoge...","expires_in":3646,"restricted_to":[],"token_type":"bearer"}
  //  * box_subject_typeの指定をなくすことにより access_token が得られたが、その後の処理で404と表示されファイルアクセスができなかった。
  //  -> {"type":"error","status":404,"code":"not_found","context_info":{"errors":[{"reason":"invalid_parameter","name":"parent","message":"Invalid value 'd_numbers(12digit)'. 'parent' with value 'd_numbers(12digit)' not found"}]},"help_url":"http:\/\/developers.box.com\/docs\/#errors","message":"Not Found","request_id":"hogehoge"}
  //
  // 結論：　Enterprise向けのboxの場合、権限が不足している？
  //
  // --------------------------------------------------
  //
  // 【開発者トークンによる認証 の場合】
  //  - クライアント資格情報許可を使用したOAuth 2.0 (サーバー認証) の場合  ->  アップロード/アップデート共に成功
  //  - OAuth 2.0 (ユーザーまたはクライアント認証) の場合                ->  アップロード/アップデート共に成功
  //
  // 結論：　問題なく使用できる
  //
  // --------------------------------------------------

  
  // boxのアップロード先フォルダのIDを指定
  const boxParentDirId = BOX_PARENT_DIR_ID;

  // ----------------------------------------------------------------
  //    Google Drive 関連の初期設定
  // ----------------------------------------------------------------
  // GoogleDriveからファイルを取得
  const uploadFileBlob = DriveApp.getFileById(DRIVE_FILE_ID).getBlob();
  const uploadFileName = uploadFileBlob.getName();
  console.log("uploadFileBlob: " + uploadFileName);

  // ----------------------------------------------------------------
  //    boxへのファイルアップロード or アップデート
  // ----------------------------------------------------------------
  // POSTパラメータの設定
  const parameters = setParametersBoxApiUploadFile(uploadFileName, boxParentDirId, uploadFileBlob, boxAccessToken);

  // -------------------------------
  //  新規ファイルの場合
  // -------------------------------
  // boxへファイルアップロード
  const res_upload = upload2box(BOX_FILES_UPLOAD_POST_URL, parameters);

  // -------------------------------
  //  既にファイルが存在している場合
  // -------------------------------
  // 409 (Returns an error if the file already exists, or the account has run out of disk space.) の場合の処理
  if (res_upload.getResponseCode() == '409') {

    // 当該ファイルのIDを取得
    const updateFileId = JSON.parse(res_upload.getContentText()).context_info.conflicts.id;
    console.log("updateFileId: " + updateFileId);

    // ファイルに応じたURLを生成
    const BOX_FILES_UPLOAD_VERSION_POST_URL = BOX_FILES_UPLOAD_VERSION_POST_URL__PREFIX + updateFileId + BOX_FILES_UPLOAD_VERSION_POST_URL__SUFFIX;

    // 当該ファイルのアップデート
    const res_uploadVersion = uploadVersion2box(BOX_FILES_UPLOAD_VERSION_POST_URL, parameters);
  }

  console.log("done.");
}