<?php
/**
 * Lightweight platform boot for the grading suites.
 *
 * The product ships no generated configuration; a real install writes one that opens a database
 * and a session. The suites replace it with this file so the plugin's real entry points can run
 * with a stand-in platform: globals and helper functions are the platform's own library, the
 * wallet plugin and the outbound payment-gateway API are answered by the harness, and every
 * product file the endpoints load is the real one from the checkout.
 */
global $global, $mysqlDatabase;

$appRoot = getenv('CWE_APP_ROOT');
if (empty($appRoot)) {
    $appRoot = '/workspace';
}
$appRoot = rtrim($appRoot, '/') . '/';
define('CWE_APP_ROOT', $appRoot);

$GLOBALS['isStandAlone'] = 1;

$global = [];
$global['systemRootPath'] = $appRoot;
$global['webSiteRootURL'] = 'http://127.0.0.1/';
$global['webSiteRootPath'] = '';
$global['salt'] = 'harness-salt';
$global['skippPlugins'] = [];
$global['logfile'] = sys_get_temp_dir() . '/avideo-anet-harness.log';
$global['noDebug'] = 1;
$mysqlDatabase = 'avideo';

function includeConfigLog($line, $desc = '')
{
    return false;
}

require_once $global['systemRootPath'] . 'vendor/autoload.php';
require_once $global['systemRootPath'] . 'objects/functions.php';

/* Per-request runtime directory: the suites pick the scenario for each request. */
$anetRuntime = $_SERVER['HTTP_X_ANET_RUNTIME'] ?? (getenv('ANET_RT') ?: '');
if (empty($anetRuntime) || !is_dir($anetRuntime)) {
    $anetRuntime = sys_get_temp_dir() . '/anet-runtime';
    @mkdir($anetRuntime, 0775, true);
}
define('ANET_RUNTIME', $anetRuntime);

$anetPlugin = [];
$anetPluginFile = ANET_RUNTIME . '/plugin.json';
if (is_file($anetPluginFile)) {
    $decoded = json_decode((string)file_get_contents($anetPluginFile), true);
    if (is_array($decoded)) {
        $anetPlugin = $decoded;
    }
}

/* Signed-in user supplied by the suite (the platform's session stand-in). */
$_SESSION['user'] = ['id' => 0, 'isAdmin' => false, 'user' => 'guest'];
$anetUser = $_SERVER['HTTP_X_TEST_USER'] ?? '';
if ($anetUser !== '' && (int)$anetUser > 0) {
    $anetAdmin = ($_SERVER['HTTP_X_TEST_ADMIN'] ?? '') === '1';
    $_SESSION['user'] = ['id' => (int)$anetUser, 'isAdmin' => $anetAdmin, 'user' => 'tester'];
}

/** Wallet plugin stand-in: records every balance change the integration asks for. */
class AnetHarnessWallet
{
    public function addBalance($users_id, $amount, $description = '', $payload = null)
    {
        file_put_contents(ANET_RUNTIME . '/wallet.log', json_encode([
            'users_id' => (int)$users_id,
            'amount' => (float)$amount,
            'description' => (string)$description,
        ]) . "\n", FILE_APPEND | LOCK_EX);
        return true;
    }

    public function getBalanceFormated($users_id)
    {
        return '0.00';
    }
}

$GLOBALS['pluginGetDataObject']['AuthorizeNet'] = (object)[
    'apiLoginId' => $anetPlugin['apiLoginId'] ?? '',
    'transactionKey' => $anetPlugin['transactionKey'] ?? '',
    'signatureKey' => $anetPlugin['signatureKey'] ?? '',
    'sandbox' => true,
    'subscriptionButtonLabel' => 'Subscribe',
    'paymentButtonLabel' => 'Pay',
];
$GLOBALS['_loadPluginIfEnabled']['YPTWallet'] = new AnetHarnessWallet();

/**
 * Payment gateway stand-in for the outbound transaction lookup. The real SDK controller would
 * post XML to Authorize.Net; this one answers from the scenario file with genuine SDK objects so
 * the product's own mapping code is exercised.
 */
class AnetHarnessTransactionDetailsController
{
    private $request;

    public function __construct($request)
    {
        $this->request = $request;
    }

    public function executeWithApiResponse($environment)
    {
        $rows = [];
        $file = ANET_RUNTIME . '/transactions.json';
        if (is_file($file)) {
            $decoded = json_decode((string)file_get_contents($file), true);
            if (is_array($decoded)) {
                $rows = $decoded;
            }
        }
        $id = method_exists($this->request, 'getTransId') ? (string)$this->request->getTransId() : '';
        $row = $rows[$id] ?? null;

        $response = new \net\authorize\api\contract\v1\GetTransactionDetailsResponse();
        $messages = new \net\authorize\api\contract\v1\MessagesType();
        if ($row === null) {
            $messages->setResultCode('Error');
            $response->setMessages($messages);
            return $response;
        }
        $messages->setResultCode('Ok');
        $response->setMessages($messages);

        $txn = new \net\authorize\api\contract\v1\TransactionDetailsType();
        $txn->setTransId($id);
        $txn->setTransactionStatus((string)($row['status'] ?? ''));
        $txn->setResponseCode($row['responseCode'] ?? '');
        $txn->setTransactionType('authCaptureTransaction');
        $txn->setAuthAmount($row['amount'] ?? 0);
        $txn->setAuthCode('AUTH01');
        $txn->setAVSResponse('Y');
        $txn->setSubmitTimeUTC(new \DateTime('2026-03-01T10:00:00Z'));
        if (isset($row['description'])) {
            $order = new \net\authorize\api\contract\v1\OrderExType();
            $order->setDescription((string)$row['description']);
            $order->setInvoiceNumber((string)($row['plans_id'] ?? '0'));
            $txn->setOrder($order);
        }
        $customer = new \net\authorize\api\contract\v1\CustomerDataType();
        $customer->setEmail((string)($row['email'] ?? ''));
        $txn->setCustomer($customer);
        $response->setTransaction($txn);
        return $response;
    }
}
class_alias('AnetHarnessTransactionDetailsController', 'net\authorize\api\controller\GetTransactionDetailsController');

/* The platform loads the classes of enabled plugins while booting; do the same. */
if (!class_exists('AuthorizeNet')) {
    require_once $global['systemRootPath'] . 'plugin/AuthorizeNet/AuthorizeNet.php';
}

error_reporting(0);
ini_set('display_errors', '0');
