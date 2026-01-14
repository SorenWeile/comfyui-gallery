"""
Database module for ComfyUI Gallery
Handles SQLite database operations for image metadata and favorites
"""

import sqlite3
import os
import time
from contextlib import contextmanager
from typing import List, Dict, Optional, Tuple

# Database configuration
DB_SCHEMA_VERSION = 1
DATABASE_FOLDER_NAME = '.gallery_cache'
DATABASE_FILENAME = 'gallery.db'

# Will be set by initialize_database()
DATABASE_DIR = None
DATABASE_FILE = None


def set_database_path(base_path: str):
    """Set the database path based on the output directory"""
    global DATABASE_DIR, DATABASE_FILE
    DATABASE_DIR = os.path.join(base_path, DATABASE_FOLDER_NAME)
    DATABASE_FILE = os.path.join(DATABASE_DIR, DATABASE_FILENAME)
    os.makedirs(DATABASE_DIR, exist_ok=True)


@contextmanager
def get_db_connection():
    """
    Context manager for database connections
    Uses WAL mode for better concurrency
    """
    if DATABASE_FILE is None:
        raise RuntimeError("Database not initialized. Call set_database_path() first.")

    conn = sqlite3.connect(DATABASE_FILE, timeout=30)
    conn.row_factory = sqlite3.Row

    # Enable WAL mode for better concurrent access
    conn.execute('PRAGMA journal_mode=WAL;')
    conn.execute('PRAGMA synchronous=NORMAL;')

    try:
        yield conn
    finally:
        conn.close()


def initialize_database():
    """
    Initialize the database schema
    Creates tables if they don't exist
    """
    print(f"INFO: Initializing database at {DATABASE_FILE}")

    with get_db_connection() as conn:
        # Check current schema version
        stored_version = conn.execute('PRAGMA user_version').fetchone()[0]

        if stored_version == 0:
            # Fresh install - create tables
            print("INFO: Creating fresh database schema")
            create_schema(conn)
            conn.execute(f'PRAGMA user_version = {DB_SCHEMA_VERSION}')
            conn.commit()
        elif stored_version < DB_SCHEMA_VERSION:
            # Upgrade needed
            print(f"INFO: Upgrading database from version {stored_version} to {DB_SCHEMA_VERSION}")
            migrate_schema(conn, stored_version)
            conn.execute(f'PRAGMA user_version = {DB_SCHEMA_VERSION}')
            conn.commit()
        else:
            print(f"INFO: Database schema up to date (version {stored_version})")


def create_schema(conn):
    """Create initial database schema"""

    # Files table - stores metadata for all images
    conn.execute('''
        CREATE TABLE IF NOT EXISTS files (
            id TEXT PRIMARY KEY,
            path TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            mtime REAL NOT NULL,
            size INTEGER DEFAULT 0,
            type TEXT,
            dimensions TEXT,
            is_favorite INTEGER DEFAULT 0,
            last_synced REAL DEFAULT 0
        )
    ''')

    # Create indices for common queries
    conn.execute('CREATE INDEX IF NOT EXISTS idx_is_favorite ON files(is_favorite)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_path ON files(path)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_mtime ON files(mtime DESC)')

    conn.commit()
    print("INFO: Database schema created successfully")


def migrate_schema(conn, from_version: int):
    """
    Migrate database schema to current version
    Non-destructive migrations
    """
    cursor = conn.execute("PRAGMA table_info(files)")
    columns = [row[1] for row in cursor.fetchall()]

    # Future migrations can be added here
    # Example:
    # if 'new_column' not in columns:
    #     conn.execute('ALTER TABLE files ADD COLUMN new_column TEXT')

    conn.commit()


def sync_files_to_database(files: List[Dict]) -> Tuple[int, int, int]:
    """
    Sync file list to database
    Returns: (added_count, updated_count, deleted_count)
    """
    with get_db_connection() as conn:
        # Get existing files from database
        existing_files = {}
        for row in conn.execute('SELECT id, path, mtime FROM files'):
            existing_files[row['path']] = {'id': row['id'], 'mtime': row['mtime']}

        # Track changes
        added = 0
        updated = 0

        # Process each file from disk
        for file in files:
            file_path = file['path']
            file_id = generate_file_id(file_path)
            file_mtime = file['modified']

            if file_path not in existing_files:
                # New file - insert
                insert_file(conn, file, file_id)
                added += 1
            elif existing_files[file_path]['mtime'] != file_mtime:
                # Modified file - update
                update_file(conn, file, file_id)
                updated += 1

            # Remove from tracking dict (remaining files are deleted)
            existing_files.pop(file_path, None)

        # Delete files that no longer exist on disk
        deleted = 0
        if existing_files:
            file_ids_to_delete = [f['id'] for f in existing_files.values()]
            placeholders = ','.join('?' * len(file_ids_to_delete))
            conn.execute(f'DELETE FROM files WHERE id IN ({placeholders})', file_ids_to_delete)
            deleted = len(file_ids_to_delete)

        conn.commit()

    return (added, updated, deleted)


def insert_file(conn, file: Dict, file_id: str):
    """Insert a new file record"""
    conn.execute('''
        INSERT INTO files (id, path, name, mtime, size, type, last_synced)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (
        file_id,
        file['path'],
        file['name'],
        file['modified'],
        file.get('size', 0),
        get_file_type(file['name']),
        time.time()
    ))


def update_file(conn, file: Dict, file_id: str):
    """Update an existing file record"""
    conn.execute('''
        UPDATE files
        SET name = ?, mtime = ?, size = ?, type = ?, last_synced = ?
        WHERE id = ?
    ''', (
        file['name'],
        file['modified'],
        file.get('size', 0),
        get_file_type(file['name']),
        time.time(),
        file_id
    ))


def get_file_type(filename: str) -> str:
    """Determine file type from extension"""
    ext = os.path.splitext(filename)[1].lower()
    if ext in ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']:
        return 'image'
    elif ext in ['.mp4', '.avi', '.mov', '.webm']:
        return 'video'
    return 'unknown'


def generate_file_id(file_path: str) -> str:
    """Generate a unique file ID from path"""
    # Use path as ID (can be enhanced with hashing if needed)
    return file_path.replace('\\', '/').replace('/', '_').replace('.', '_')


def get_files_with_favorites(files: List[Dict]) -> List[Dict]:
    """
    Enhance file list with favorite status from database
    """
    if not files:
        return files

    with get_db_connection() as conn:
        # Get all file paths
        file_paths = [f['path'] for f in files]
        placeholders = ','.join('?' * len(file_paths))

        # Query favorites
        cursor = conn.execute(
            f'SELECT path, is_favorite FROM files WHERE path IN ({placeholders})',
            file_paths
        )

        # Create lookup dict
        favorites_map = {row['path']: bool(row['is_favorite']) for row in cursor}

    # Add is_favorite to each file
    for file in files:
        file['is_favorite'] = favorites_map.get(file['path'], False)

    return files


def toggle_favorite(file_path: str) -> bool:
    """
    Toggle favorite status for a file
    Returns: new favorite status (True/False)
    """
    file_id = generate_file_id(file_path)

    with get_db_connection() as conn:
        # Get current status
        row = conn.execute('SELECT is_favorite FROM files WHERE id = ?', (file_id,)).fetchone()

        if row is None:
            # File not in database - need to add it first
            return False

        # Toggle status
        new_status = 1 - row['is_favorite']
        conn.execute('UPDATE files SET is_favorite = ? WHERE id = ?', (new_status, file_id))
        conn.commit()

        return bool(new_status)


def set_favorite_batch(file_paths: List[str], is_favorite: bool) -> int:
    """
    Set favorite status for multiple files
    Returns: number of files updated
    """
    if not file_paths:
        return 0

    file_ids = [generate_file_id(path) for path in file_paths]

    with get_db_connection() as conn:
        placeholders = ','.join('?' * len(file_ids))
        cursor = conn.execute(
            f'UPDATE files SET is_favorite = ? WHERE id IN ({placeholders})',
            [1 if is_favorite else 0] + file_ids
        )
        conn.commit()
        return cursor.rowcount


def get_favorites() -> List[Dict]:
    """
    Get all favorited files
    Returns list of file records
    """
    with get_db_connection() as conn:
        cursor = conn.execute('''
            SELECT path, name, mtime, size, type, dimensions
            FROM files
            WHERE is_favorite = 1
            ORDER BY mtime DESC
        ''')

        favorites = []
        for row in cursor:
            favorites.append({
                'path': row['path'],
                'name': row['name'],
                'modified': row['mtime'],
                'modified_str': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(row['mtime'])),
                'size': row['size'],
                'type': row['type'],
                'is_favorite': True
            })

        return favorites


def get_favorite_count() -> int:
    """Get total number of favorited files"""
    with get_db_connection() as conn:
        row = conn.execute('SELECT COUNT(*) as count FROM files WHERE is_favorite = 1').fetchone()
        return row['count'] if row else 0


def cleanup_database():
    """
    Cleanup database - remove orphaned records
    This can be called periodically for maintenance
    """
    with get_db_connection() as conn:
        # VACUUM to reclaim space
        conn.execute('VACUUM')
        conn.commit()

    print("INFO: Database cleanup completed")
