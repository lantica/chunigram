create table if not exists "user" (
    "id"                integer primary key,
    "rating"            real not null default 0,
    "maxRating"         real not null default 0,
    "bestRating"        real not null default 0,
    "bestSongs"         jsonb,
    "altSongs"          jsonb,
    "lastUpdated"       timestamp with time zone
);
