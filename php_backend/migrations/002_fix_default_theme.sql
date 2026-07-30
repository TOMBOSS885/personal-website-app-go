ALTER TABLE themes
    MODIFY preset_key VARCHAR(100) NOT NULL DEFAULT 'purple-pink';

UPDATE themes
SET preset_key = 'purple-pink'
WHERE preset_key NOT IN (
    'purple-pink',
    'blue-cyan',
    'green-teal',
    'orange-red',
    'dark-purple',
    'minimal',
    'custom'
);
