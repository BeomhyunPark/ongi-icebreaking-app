BEGIN READ ONLY;
SELECT current_database(), current_timestamp;
SELECT c.code, l.variant_code, count(*) AS cumulative_likes,
       min(l.created_at) AS first_like, max(l.created_at) AS latest_like
FROM content_like l JOIN content c ON c.id = l.content_id
GROUP BY c.code, l.variant_code ORDER BY c.code, l.variant_code;
SELECT c.code, l.variant_code, (l.created_at AT TIME ZONE 'Asia/Seoul')::date AS day,
       count(*) AS retained_likes
FROM content_like l JOIN content c ON c.id = l.content_id
GROUP BY c.code, l.variant_code, day ORDER BY day, c.code, l.variant_code;
COMMIT;
