<?php

declare(strict_types=1);

const APP_LIVE2D_BUNDLE_MAGIC = 'L2DBNDL1';
const APP_LIVE2D_MAX_MODELS = 3;
const APP_LIVE2D_MAX_FILES = 256;
const APP_LIVE2D_MAX_BUNDLE_BYTES = 20971520;
const APP_LIVE2D_MAX_FILE_BYTES = 15728640;

function app_live2d_model_payload(array $row, bool $includeStorage = false): array
{
    $model = [
        'id' => (int) $row['id'],
        'name' => (string) $row['name'],
        'modelPath' => (string) $row['model_path'],
        'active' => (bool) $row['active'],
        'scale' => (float) $row['scale'],
        'offsetX' => (float) $row['offset_x'],
        'offsetY' => (float) $row['offset_y'],
        'volume' => (float) $row['volume'],
        'tipsEnabled' => (bool) $row['tips_enabled'],
        'welcomeMessages' => (string) $row['welcome_messages'],
        'tipMessages' => (string) $row['tip_messages'],
        'tipDuration' => (int) $row['tip_duration'],
        'tipInterval' => (int) $row['tip_interval'],
        'tipOffsetX' => (int) $row['tip_offset_x'],
        'tipOffsetY' => (int) $row['tip_offset_y'],
        'typingEnabled' => (bool) $row['typing_enabled'],
        'typingParam' => (string) $row['typing_param'],
        'typingSpeed' => (int) $row['typing_speed'],
        'typingMinValue' => (float) $row['typing_min_value'],
        'typingMaxValue' => (float) $row['typing_max_value'],
    ];
    if ($includeStorage) {
        $root = app_live2d_model_root((string) $row['model_path']);
        $model['storageBytes'] = $root ? app_live2d_directory_size($root) : 0;
    }
    return $model;
}

function app_live2d_settings_payload(array $row): array
{
    return [
        'enabled' => (bool) $row['enabled'],
        'position' => (string) $row['position'],
        'size' => (int) $row['size'],
        'primaryColor' => (string) $row['primary_color'],
        'transitionType' => (string) $row['transition_type'],
        'transitionDuration' => (int) $row['transition_duration'],
        'menuAlign' => (string) $row['menu_align'],
        'showSleepButton' => (bool) $row['show_sleep_button'],
        'showAboutButton' => (bool) $row['show_about_button'],
    ];
}

function app_live2d_admin_state(): array
{
    $settings = app_db()->query('SELECT * FROM live2d_settings WHERE id = 1')->fetch();
    if (!$settings) app_error(500, 'Live2D 设置尚未初始化', 'LIVE2D_SETTINGS_MISSING');
    $models = array_map(function ($row) {
        return app_live2d_model_payload($row, true);
    }, app_db()->query('SELECT * FROM live2d_models ORDER BY active DESC, id DESC')->fetchAll());
    return ['settings' => app_live2d_settings_payload($settings), 'models' => $models, 'maxModels' => APP_LIVE2D_MAX_MODELS];
}

function app_live2d_import_bundle(): array
{
    if ((int) app_db()->query('SELECT COUNT(*) FROM live2d_models')->fetchColumn() >= APP_LIVE2D_MAX_MODELS) {
        app_error(409, '最多保留 3 个 Live2D 模型，请先删除旧模型', 'LIVE2D_MODEL_LIMIT');
    }
    if (empty($_FILES['bundle']) || !is_array($_FILES['bundle'])) {
        app_error(400, '请选择 Live2D 模型文件夹', 'LIVE2D_BUNDLE_REQUIRED');
    }
    $upload = $_FILES['bundle'];
    if ((int) ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        app_error(400, '模型上传被 PHP 限制，请检查 upload_max_filesize 和 post_max_size', 'LIVE2D_UPLOAD_REJECTED');
    }
    $size = (int) ($upload['size'] ?? 0);
    if ($size <= 0 || $size > APP_LIVE2D_MAX_BUNDLE_BYTES) {
        app_error(413, '压缩后的模型不能超过 20MB', 'LIVE2D_BUNDLE_TOO_LARGE');
    }
    $temporaryPath = (string) ($upload['tmp_name'] ?? '');
    if (!is_uploaded_file($temporaryPath)) app_error(400, '模型上传文件无效', 'LIVE2D_UPLOAD_INVALID');

    $handle = fopen($temporaryPath, 'rb');
    if (!$handle) app_error(500, '无法读取模型上传包', 'LIVE2D_BUNDLE_READ_FAILED');
    $magic = app_live2d_read_exact($handle, 8);
    $lengthBytes = app_live2d_read_exact($handle, 4);
    if ($magic !== APP_LIVE2D_BUNDLE_MAGIC || strlen($lengthBytes) !== 4) {
        fclose($handle);
        app_error(400, '模型上传包格式无效', 'LIVE2D_BUNDLE_INVALID');
    }
    $manifestLength = (int) (unpack('Vlength', $lengthBytes)['length'] ?? 0);
    if ($manifestLength <= 0 || $manifestLength > 524288) {
        fclose($handle);
        app_error(400, '模型清单大小无效', 'LIVE2D_MANIFEST_INVALID');
    }
    $manifestRaw = app_live2d_read_exact($handle, $manifestLength);
    $manifest = json_decode($manifestRaw, true);
    if (!is_array($manifest) || (int) ($manifest['version'] ?? 0) !== 1 || !is_array($manifest['files'] ?? null)) {
        fclose($handle);
        app_error(400, '模型清单格式无效', 'LIVE2D_MANIFEST_INVALID');
    }

    $files = app_live2d_validate_manifest_files($manifest['files']);
    $entryPath = app_live2d_safe_path((string) ($manifest['entryPath'] ?? ''));
    if (!preg_match('/(?:^|\/)(?:model\.json|[^\/]+\.model(?:3)?\.json)$/i', $entryPath)) {
        fclose($handle);
        app_error(400, '模型入口必须是 model.json 或 .model3.json', 'LIVE2D_ENTRY_INVALID');
    }
    $filePaths = array_column($files, 'path');
    if (!in_array($entryPath, $filePaths, true)) {
        fclose($handle);
        app_error(400, '模型入口不在上传包中', 'LIVE2D_ENTRY_MISSING');
    }

    $name = trim((string) ($_POST['name'] ?? 'Live2D 模型'));
    if ($name === '') $name = 'Live2D 模型';
    if (function_exists('mb_substr')) $name = mb_substr($name, 0, 80);
    else $name = substr($name, 0, 80);

    $config = app_config()['app'];
    $slug = date('YmdHis') . '-' . bin2hex(random_bytes(6));
    $live2dRoot = rtrim((string) $config['upload_dir'], '/\\') . '/live2d';
    $modelRoot = $live2dRoot . '/' . $slug;
    if (!is_dir($modelRoot) && !mkdir($modelRoot, 0755, true) && !is_dir($modelRoot)) {
        fclose($handle);
        app_error(500, '无法创建 Live2D 上传目录', 'LIVE2D_DIRECTORY_FAILED');
    }

    try {
        foreach ($files as $file) {
            $target = $modelRoot . '/' . $file['path'];
            $directory = dirname($target);
            if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
                throw new RuntimeException('无法创建模型子目录');
            }
            app_live2d_copy_exact($handle, $target, $file['size']);
            @chmod($target, 0644);
        }
        if (fread($handle, 1) !== '') throw new RuntimeException('模型上传包包含未声明数据');
        fclose($handle);

        $entryFile = $modelRoot . '/' . $entryPath;
        $entryJson = json_decode((string) file_get_contents($entryFile), true);
        if (!is_array($entryJson)) throw new RuntimeException('模型入口 JSON 无效');

        $modelUrl = rtrim((string) $config['upload_url'], '/') . '/live2d/' . $slug . '/' . $entryPath;
        app_db()->beginTransaction();
        app_db()->exec('UPDATE live2d_models SET active = 0');
        $statement = app_db()->prepare('INSERT INTO live2d_models (name, model_path, active) VALUES (?, ?, 1)');
        $statement->execute([$name, $modelUrl]);
        $id = (int) app_db()->lastInsertId();
        app_db()->exec('UPDATE live2d_settings SET enabled = 1 WHERE id = 1');
        app_db()->commit();

        $statement = app_db()->prepare('SELECT * FROM live2d_models WHERE id = ?');
        $statement->execute([$id]);
        return app_live2d_model_payload($statement->fetch(), true);
    } catch (PDOException $error) {
        if (app_db()->inTransaction()) app_db()->rollBack();
        if (is_resource($handle)) fclose($handle);
        app_live2d_remove_tree($modelRoot);
        throw $error;
    } catch (Throwable $error) {
        if (is_resource($handle)) fclose($handle);
        app_live2d_remove_tree($modelRoot);
        error_log($error->__toString());
        app_error(400, 'Live2D 模型导入失败，请检查模型文件完整性', 'LIVE2D_IMPORT_FAILED');
    }
}

function app_live2d_update_settings(): array
{
    $body = app_body();
    $position = in_array(($body['position'] ?? ''), ['bottom-left', 'bottom-right'], true) ? $body['position'] : 'bottom-right';
    $statement = app_db()->prepare('UPDATE live2d_settings SET enabled=?, position=?, size=? WHERE id=1');
    $statement->execute([
        app_bool($body['enabled'] ?? false) ? 1 : 0,
        $position,
        app_clamp(app_int($body['size'] ?? 240), 160, 420),
    ]);
    $row = app_db()->query('SELECT * FROM live2d_settings WHERE id = 1')->fetch();
    return app_live2d_settings_payload($row);
}

function app_live2d_update_model(int $id): array
{
    $body = app_body();
    $name = trim((string) ($body['name'] ?? ''));
    if ($name === '') app_error(400, '模型名称不能为空');
    $statement = app_db()->prepare('UPDATE live2d_models SET name=?, scale=?, offset_x=?, offset_y=? WHERE id=?');
    $statement->execute([
        $name,
        max(0.2, min(3.0, (float) ($body['scale'] ?? 1))),
        max(-2.0, min(2.0, (float) ($body['offsetX'] ?? 0))),
        max(-2.0, min(2.0, (float) ($body['offsetY'] ?? 0))),
        $id,
    ]);
    $statement = app_db()->prepare('SELECT * FROM live2d_models WHERE id = ?');
    $statement->execute([$id]);
    $row = $statement->fetch();
    if (!$row) app_error(404, '模型不存在', 'NOT_FOUND');
    return app_live2d_model_payload($row, true);
}

function app_live2d_activate_model(int $id): array
{
    $statement = app_db()->prepare('SELECT id FROM live2d_models WHERE id = ?');
    $statement->execute([$id]);
    if (!$statement->fetch()) app_error(404, '模型不存在', 'NOT_FOUND');
    app_db()->beginTransaction();
    app_db()->exec('UPDATE live2d_models SET active = 0');
    $statement = app_db()->prepare('UPDATE live2d_models SET active = 1 WHERE id = ?');
    $statement->execute([$id]);
    app_db()->exec('UPDATE live2d_settings SET enabled = 1 WHERE id = 1');
    app_db()->commit();
    return app_live2d_admin_state();
}

function app_live2d_delete_model(int $id): array
{
    $statement = app_db()->prepare('SELECT * FROM live2d_models WHERE id = ?');
    $statement->execute([$id]);
    $row = $statement->fetch();
    if (!$row) app_error(404, '模型不存在', 'NOT_FOUND');
    $root = app_live2d_model_root((string) $row['model_path']);
    $wasActive = (bool) $row['active'];
    app_db()->prepare('DELETE FROM live2d_models WHERE id = ?')->execute([$id]);
    if ($wasActive) {
        $nextId = app_db()->query('SELECT id FROM live2d_models ORDER BY id DESC LIMIT 1')->fetchColumn();
        if ($nextId) app_db()->prepare('UPDATE live2d_models SET active = 1 WHERE id = ?')->execute([(int) $nextId]);
        else app_db()->exec('UPDATE live2d_settings SET enabled = 0 WHERE id = 1');
    }
    if ($root) app_live2d_remove_tree($root);
    return ['success' => true];
}

function app_live2d_validate_manifest_files(array $files): array
{
    if (count($files) === 0 || count($files) > APP_LIVE2D_MAX_FILES) {
        app_error(400, '模型运行文件数量必须在 1 到 256 之间', 'LIVE2D_FILE_COUNT_INVALID');
    }
    $result = [];
    $seen = [];
    $total = 0;
    foreach ($files as $file) {
        if (!is_array($file)) app_error(400, '模型文件清单无效', 'LIVE2D_MANIFEST_INVALID');
        $path = app_live2d_safe_path((string) ($file['path'] ?? ''));
        $size = (int) ($file['size'] ?? 0);
        if ($size <= 0 || $size > APP_LIVE2D_MAX_FILE_BYTES) app_error(400, '模型单文件大小无效', 'LIVE2D_FILE_SIZE_INVALID');
        if (!preg_match('/\.(?:json|moc3?|mtn|exp|png|jpe?g|webp)$/i', $path)) {
            app_error(400, '模型包含不允许的文件类型', 'LIVE2D_FILE_TYPE_BLOCKED');
        }
        $key = strtolower($path);
        if (isset($seen[$key])) app_error(400, '模型包含重复文件路径', 'LIVE2D_DUPLICATE_PATH');
        $seen[$key] = true;
        $total += $size;
        if ($total > APP_LIVE2D_MAX_BUNDLE_BYTES) app_error(413, '模型运行文件超过 20MB', 'LIVE2D_BUNDLE_TOO_LARGE');
        $result[] = ['path' => $path, 'size' => $size];
    }
    return $result;
}

function app_live2d_safe_path(string $path): string
{
    $path = trim(str_replace('\\', '/', $path), '/');
    if ($path === '' || strlen($path) > 500 || strpos($path, "\0") !== false) {
        app_error(400, '模型文件路径无效', 'LIVE2D_PATH_INVALID');
    }
    foreach (explode('/', $path) as $part) {
        if ($part === '' || $part === '.' || $part === '..' || strlen($part) > 160 || preg_match('/[\x00-\x1F<>:"|?*]/', $part)) {
            app_error(400, '模型文件路径无效', 'LIVE2D_PATH_INVALID');
        }
    }
    return $path;
}

function app_live2d_read_exact($handle, int $length): string
{
    $data = '';
    while (strlen($data) < $length && !feof($handle)) {
        $chunk = fread($handle, $length - strlen($data));
        if ($chunk === false) break;
        $data .= $chunk;
    }
    return $data;
}

function app_live2d_copy_exact($handle, string $target, int $length): void
{
    $output = fopen($target, 'wb');
    if (!$output) throw new RuntimeException('无法写入模型文件');
    $remaining = $length;
    while ($remaining > 0) {
        $chunk = fread($handle, min(65536, $remaining));
        if ($chunk === false || $chunk === '') {
            fclose($output);
            throw new RuntimeException('模型上传包数据不完整');
        }
        if (fwrite($output, $chunk) !== strlen($chunk)) {
            fclose($output);
            throw new RuntimeException('模型文件写入失败');
        }
        $remaining -= strlen($chunk);
    }
    fclose($output);
}

function app_live2d_model_root(string $modelPath): ?string
{
    $config = app_config()['app'];
    $path = (string) (parse_url($modelPath, PHP_URL_PATH) ?: '');
    $prefix = rtrim((string) $config['upload_url'], '/') . '/live2d/';
    if (substr($path, 0, strlen($prefix)) !== $prefix) return null;
    $relative = substr($path, strlen($prefix));
    $slug = explode('/', $relative)[0] ?? '';
    if (!preg_match('/^[a-zA-Z0-9_-]+$/', $slug)) return null;
    return rtrim((string) $config['upload_dir'], '/\\') . '/live2d/' . $slug;
}

function app_live2d_directory_size(string $directory): int
{
    if (!is_dir($directory)) return 0;
    $size = 0;
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS));
    foreach ($iterator as $file) if ($file->isFile()) $size += $file->getSize();
    return $size;
}

function app_live2d_remove_tree(string $directory): bool
{
    if (!is_dir($directory)) return true;
    $live2dRoot = rtrim((string) app_config()['app']['upload_dir'], '/\\') . '/live2d';
    $normalizedDirectory = str_replace('\\', '/', $directory);
    $normalizedRoot = rtrim(str_replace('\\', '/', $live2dRoot), '/');
    if (substr($normalizedDirectory, 0, strlen($normalizedRoot) + 1) !== $normalizedRoot . '/') return false;
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($iterator as $item) {
        if ($item->isDir() && !$item->isLink()) @rmdir($item->getPathname());
        else @unlink($item->getPathname());
    }
    return @rmdir($directory);
}
