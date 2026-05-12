CREATE TABLE players (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE target_servers (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    security_level INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE data_packets (
    id VARCHAR(255) PRIMARY KEY,
    target_server_id VARCHAR(255) REFERENCES target_servers(id),
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE virus_actions (
    id VARCHAR(255) PRIMARY KEY,
    player_id VARCHAR(255) REFERENCES players(id),
    target_server_id VARCHAR(255) REFERENCES target_servers(id),
    packet_id VARCHAR(255) REFERENCES data_packets(id),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    actions_resolved INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
