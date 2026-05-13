CREATE TABLE players (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    credits INTEGER DEFAULT 5000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE target_servers (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    security_level INTEGER DEFAULT 0,
    base_cost INTEGER DEFAULT 100,
    gain_multiplier DECIMAL(5,2) DEFAULT 1.0,
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

-- Seed Initial Data
INSERT INTO target_servers (id, name, security_level, base_cost, gain_multiplier) VALUES
('srv-mainframe', 'Central Mainframe', 10, 100, 1.0),
('srv-proxy', 'Proxy Server (Low Risk)', 5, 50, 0.5),
('srv-vault', 'Corporate Vault (High Risk)', 20, 200, 3.0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO data_packets (id, target_server_id, content) VALUES
('pkt-1', 'srv-mainframe', 'Encrypted Financial Records'),
('pkt-2', 'srv-proxy', 'Routing Logs'),
('pkt-3', 'srv-vault', 'Zero-Day Exploits Archive')
ON CONFLICT (id) DO NOTHING;
