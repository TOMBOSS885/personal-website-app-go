<?php

declare(strict_types=1);

function app_creator_text($value, int $max, string $label, bool $required = false): string
{
    $text = trim((string) $value);
    if ($required && $text === '') app_error(400, $label . '不能为空。', 'VALIDATION_FAILED');
    $length = function_exists('mb_strlen') ? mb_strlen($text, 'UTF-8') : strlen($text);
    if ($length > $max) app_error(422, $label . '长度不能超过 ' . $max . ' 个字符。', 'VALIDATION_FAILED');
    if (preg_match('/[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]/', $text)) app_error(422, $label . '包含非法控制字符。', 'VALIDATION_FAILED');
    return $text;
}

function app_creator_url($value, string $label): string
{
    $url = app_creator_text($value, 2048, $label);
    if ($url !== '' && (!filter_var($url, FILTER_VALIDATE_URL) || !in_array(strtolower((string) parse_url($url, PHP_URL_SCHEME)), ['http', 'https'], true))) {
        app_error(422, $label . '必须是 http 或 https 地址。', 'VALIDATION_FAILED');
    }
    return $url;
}

function app_creator_article_select(): string
{
    return "SELECT a.*, u.email AS creator_email, u.nickname AS creator_nickname FROM articles a LEFT JOIN user_accounts u ON u.id = a.creator_user_id";
}

function app_creator_project_select(): string
{
    return "SELECT p.*, u.email AS creator_email, u.nickname AS creator_nickname FROM projects p LEFT JOIN user_accounts u ON u.id = p.creator_user_id";
}

function app_creator_require_owner(string $type, int $id): array
{
    $profile = app_user_admin_required();
    $table = $type === 'article' ? 'articles' : 'projects';
    $stmt = app_db()->prepare("SELECT * FROM $table WHERE id = ? AND creator_user_id = ?");
    $stmt->execute([$id, $profile['id']]);
    $row = $stmt->fetch();
    if (!$row) app_error(404, '内容不存在或不属于当前账号。', 'CONTENT_NOT_FOUND');
    return [$profile, $row];
}

function app_creator_articles(): array
{
    app_require_schema_018();
    $profile = app_user_admin_required();
    $stmt = app_db()->prepare(app_creator_article_select() . ' WHERE a.creator_user_id = ? ORDER BY a.updated_at DESC, a.id DESC');
    $stmt->execute([$profile['id']]);
    return array_map(static function (array $row): array {
        $item = app_article_row($row, false, true);
        $item['creatorId'] = (int) $row['creator_user_id'];
        $item['author'] = app_content_author_payload($row);
        return $item;
    }, $stmt->fetchAll());
}

function app_creator_article_detail(int $id): void
{
    [$profile, $owned] = app_creator_require_owner('article', $id);
    $stmt = app_db()->prepare(app_creator_article_select() . ' WHERE a.id = ? AND a.creator_user_id = ?');
    $stmt->execute([$id, $profile['id']]);
    $row = $stmt->fetch() ?: $owned;
    $item = app_article_row($row, true, true);
    $item['creatorId'] = (int) $row['creator_user_id'];
    $item['author'] = app_content_author_payload($row);
    app_json($item);
}

function app_creator_save_article(?int $id): void
{
    app_require_schema_018();
    $profile = app_user_admin_required();
    app_user_csrf_required();
    $body = app_body();
    $title = app_creator_text($body['title'] ?? '', 200, '标题', true);
    $content = app_creator_text($body['content'] ?? '', 2 * 1024 * 1024, '正文', true);
    $db = app_db();
    $before = null;
    if ($id !== null) [, $before] = app_creator_require_owner('article', $id);
    [$seriesName] = app_series_name_parts(app_creator_text($body['seriesName'] ?? '', 120, '专题名称'));
    $values = [$title, app_creator_text($body['summary'] ?? '', 500, '摘要'), $content, app_creator_text($body['coverImage'] ?? '', 2048, '封面地址'), app_creator_text($body['category'] ?? '', 120, '分类'), '', $seriesName, app_clamp(app_int($body['seriesOrder'] ?? 0), 0, 1000000), app_bool($body['featured'] ?? false) ? 1 : 0, app_clamp(app_int($body['displayOrder'] ?? 0), 0, 1000000), app_bool($body['published'] ?? false) ? 1 : 0];
    $tags = app_sync_content_tags($db, 'article', $id ?? 0, $body['tags'] ?? '');
    $values[5] = $tags;
    if ($id === null) {
        $stmt = $db->prepare('INSERT INTO articles (title,summary,content,cover_image,category,tags,series_name,series_order,featured,display_order,published,login_required,requires_oauth_identity,content_type,creator_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,\'markdown\',?,NOW(),NOW())');
        $stmt->execute(array_merge($values, [1, 1, $profile['id']]));
        $id = (int) $db->lastInsertId();
        // Re-key tags after the new id exists.
        app_sync_content_tags($db, 'article', $id, $tags);
    } else {
        $stmt = $db->prepare('UPDATE articles SET title=?,summary=?,content=?,cover_image=?,category=?,tags=?,series_name=?,series_order=?,featured=?,display_order=?,published=?,login_required=1,requires_oauth_identity=1,updated_at=NOW() WHERE id=? AND creator_user_id=?');
        $stmt->execute(array_merge($values, [$id, $profile['id']]));
    }
    $afterStmt = $db->prepare('SELECT * FROM articles WHERE id = ?'); $afterStmt->execute([$id]); $after = $afterStmt->fetch() ?: [];
    app_audit_set_change('article', $id, $before, $after, $before ? 'UPDATE creator article' : 'CREATE creator article');
    app_public_cache_clear();
    app_json(app_article_row($after, true, true), $before ? 200 : 201);
}

function app_creator_delete_article(int $id): void
{
    [, $row] = app_creator_require_owner('article', $id); app_user_csrf_required();
    app_db()->prepare('DELETE FROM articles WHERE id = ? AND creator_user_id = ?')->execute([$id, (int) $_SESSION['user_id']]);
    app_audit_set_change('article', $id, $row, null, 'DELETE creator article'); app_public_cache_clear(); app_json(['success' => true]);
}

function app_creator_projects(): array
{
    app_require_schema_018(); $profile = app_user_admin_required();
    $stmt = app_db()->prepare(app_creator_project_select() . ' WHERE p.creator_user_id = ? ORDER BY p.updated_at DESC, p.id DESC'); $stmt->execute([$profile['id']]);
    return array_map(static function (array $row): array { $item = ['id'=>(int)$row['id'],'name'=>$row['name'],'description'=>$row['description'],'coverImage'=>$row['cover_image'],'techStack'=>$row['tech_stack'],'githubUrl'=>$row['github_url'],'demoUrl'=>$row['demo_url'],'stars'=>(int)$row['stars'],'featured'=>(bool)$row['featured'],'displayOrder'=>(int)$row['display_order'],'tags'=>$row['tags'] ?? '','creatorId'=>(int)$row['creator_user_id'],'author'=>app_content_author_payload($row),'createdAt'=>app_now_iso($row['created_at']),'updatedAt'=>app_now_iso($row['updated_at'])]; return $item; }, $stmt->fetchAll());
}

function app_creator_save_project(?int $id): void
{
    app_require_schema_018(); $profile = app_user_admin_required(); app_user_csrf_required(); $body = app_body();
    $name = app_creator_text($body['name'] ?? '', 200, '项目名称', true);
    $db = app_db(); $before = null; if ($id !== null) [, $before] = app_creator_require_owner('project', $id);
    $values = [$name,app_creator_text($body['description']??'',2000,'项目描述'),app_creator_text($body['coverImage']??'',2048,'封面地址'),app_creator_text($body['techStack']??'',500,'技术栈'),app_creator_url($body['githubUrl']??'','GitHub 地址'),app_creator_url($body['demoUrl']??'','演示地址'),app_clamp(app_int($body['stars']??0),0,2147483647),app_bool($body['featured']??false)?1:0,app_clamp(app_int($body['displayOrder']??0),0,1000000),app_sync_content_tags($db,'project',$id??0,$body['tags']??'')];
    if ($id === null) { $stmt=$db->prepare('INSERT INTO projects (name,description,cover_image,tech_stack,github_url,demo_url,stars,featured,display_order,tags,creator_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())'); $stmt->execute(array_merge($values,[$profile['id']])); $id=(int)$db->lastInsertId(); app_sync_content_tags($db,'project',$id,$values[9]); }
    else { $stmt=$db->prepare('UPDATE projects SET name=?,description=?,cover_image=?,tech_stack=?,github_url=?,demo_url=?,stars=?,featured=?,display_order=?,tags=?,updated_at=NOW() WHERE id=? AND creator_user_id=?'); $stmt->execute(array_merge($values,[$id,$profile['id']])); }
    $afterStmt=$db->prepare('SELECT * FROM projects WHERE id=?');$afterStmt->execute([$id]);$after=$afterStmt->fetch()?:[]; app_audit_set_change('project',$id,$before,$after,$before?'UPDATE creator project':'CREATE creator project'); app_public_cache_clear(); app_json(['success'=>true,'id'=>$id],$before?200:201);
}

function app_creator_delete_project(int $id): void
{
    [, $row] = app_creator_require_owner('project', $id); app_user_csrf_required(); app_db()->prepare('DELETE FROM projects WHERE id=? AND creator_user_id=?')->execute([$id,(int)$_SESSION['user_id']]); app_audit_set_change('project',$id,$row,null,'DELETE creator project'); app_public_cache_clear(); app_json(['success'=>true]);
}
