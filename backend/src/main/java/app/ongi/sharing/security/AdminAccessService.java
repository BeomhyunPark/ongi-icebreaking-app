package app.ongi.sharing.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import app.ongi.sharing.common.ApiException;
import app.ongi.sharing.config.OngiProperties;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class AdminAccessService {

    private final String adminKey;

    public AdminAccessService(OngiProperties properties) {
        this.adminKey = properties.admin().key() == null ? "" : properties.admin().key().strip();
    }

    public void requireAccess(String candidate) {
        if (adminKey.isBlank()) {
            throw new ApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "ADMIN_ACCESS_NOT_CONFIGURED",
                "관리자 접근 키가 설정되지 않았습니다."
            );
        }
        byte[] expected = adminKey.getBytes(StandardCharsets.UTF_8);
        byte[] actual = candidate == null ? new byte[0] : candidate.strip().getBytes(StandardCharsets.UTF_8);
        if (!MessageDigest.isEqual(expected, actual)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "ADMIN_ACCESS_DENIED", "관리자 키를 확인해주세요.");
        }
    }
}
