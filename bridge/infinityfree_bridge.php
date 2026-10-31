<?php
/**
 * infinityfree_bridge.php — Secure PHP Database Gateway for InfinityFree MySQL
 * 
 * Instructions:
 * 1. Upload this file to your InfinityFree account under `htdocs/api_bridge.php`.
 * 2. Set your custom secure token below in BRIDGE_SECRET.
 * 3. Test connectivity by visiting:
 *    https://<your-infinityfree-subdomain>/api_bridge.php?ping=1
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ── Security Configuration ──────────────────────────────────────────
define('BRIDGE_SECRET', 'lyka-crm-secure-bridge-key-2026'); // Change to your preferred key

// Database Configuration
define('DB_HOST', 'sql308.infinityfree.com');
define('DB_PORT', 3306);
define('DB_USER', 'if0_41190104');
define('DB_NAME', 'if0_41190104_lyka_voice_agent');
// In InfinityFree, the MySQL password is your vPanel Account Password (found in Client Area -> Account Details)
define('DB_PASS', 'YOUR_INFINITYFREE_ACCOUNT_PASSWORD_HERE');

// ── Authentication Check ────────────────────────────────────────────
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if (!preg_match('/Bearer\s+(\S+)/', $authHeader, $matches) && ($_GET['token'] ?? '') !== BRIDGE_SECRET) {
    if (($_GET['ping'] ?? '') !== '1') {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized: Invalid or missing bridge token.']);
        exit;
    }
}

// ── Database Connection ─────────────────────────────────────────────
try {
    $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database connection failed inside InfinityFree server: ' . $e->getMessage(),
        'host' => DB_HOST,
        'database' => DB_NAME,
    ]);
    exit;
}

// ── Ping / Diagnostic Mode ──────────────────────────────────────────
if (isset($_GET['ping'])) {
    $tables = [];
    try {
        $stmt = $pdo->query('SHOW TABLES');
        $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    } catch (Exception $e) {}

    echo json_encode([
        'success' => true,
        'message' => 'Connected to InfinityFree MySQL successfully via internal PHP bridge.',
        'host' => DB_HOST,
        'database' => DB_NAME,
        'table_count' => count($tables),
        'tables' => $tables,
    ]);
    exit;
}

// ── Query Execution Mode ────────────────────────────────────────────
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

if (!isset($data['sql'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing "sql" property in request payload.']);
    exit;
}

$sql = trim($data['sql']);
$params = $data['params'] ?? [];

// Restrict to safe operations (prevent multiple chained queries)
if (strpos($sql, ';') !== false && substr_count($sql, ';') > 1) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Multiple statements in single request not allowed.']);
    exit;
}

try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $isSelect = preg_match('/^\s*(SELECT|SHOW|DESCRIBE|EXPLAIN)\b/i', $sql);
    if ($isSelect) {
        $rows = $stmt->fetchAll();
        echo json_encode(['success' => true, 'rows' => $rows, 'count' => count($rows)]);
    } else {
        $affected = $stmt->rowCount();
        echo json_encode(['success' => true, 'affectedRows' => $affected, 'insertId' => $pdo->lastInsertId()]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
