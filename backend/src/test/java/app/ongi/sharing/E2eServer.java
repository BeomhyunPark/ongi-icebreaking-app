package app.ongi.sharing;

import org.springframework.boot.SpringApplication;
import org.testcontainers.containers.PostgreSQLContainer;

/** Browser tests own a fresh disposable database, never the developer/production DB. */
public final class E2eServer {
    public static void main(String[] args) {
        PostgreSQLContainer<?> database = new PostgreSQLContainer<>("postgres:16-alpine");
        database.start();
        Runtime.getRuntime().addShutdownHook(new Thread(database::stop));
        System.setProperty("spring.datasource.url", database.getJdbcUrl());
        System.setProperty("spring.datasource.username", database.getUsername());
        System.setProperty("spring.datasource.password", database.getPassword());
        System.setProperty("server.address", "127.0.0.1");
        System.setProperty("server.port", "18080");
        System.setProperty("ongi.allowed-origins", "http://127.0.0.1:4176");
        System.setProperty("ongi.session.secure-cookie", "false");
        System.setProperty("ongi.room.minimum-participants", "3");
        System.setProperty("ongi.realtime.heartbeat", "1s");
        SpringApplication.run(OngiBackendApplication.class, args);
    }
}
