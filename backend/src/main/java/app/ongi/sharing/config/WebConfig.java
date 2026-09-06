package app.ongi.sharing.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import app.ongi.sharing.security.MutationGuardInterceptor;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final OngiProperties properties;
    private final MutationGuardInterceptor mutationGuardInterceptor;

    public WebConfig(OngiProperties properties, MutationGuardInterceptor mutationGuardInterceptor) {
        this.properties = properties;
        this.mutationGuardInterceptor = mutationGuardInterceptor;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
            .allowedOrigins(properties.allowedOrigins().toArray(String[]::new))
            .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
            .allowedHeaders(
                "Content-Type",
                "X-OnGi-Client",
                "X-OnGi-Admin-Key",
                "X-Gureumi-Resume-Token",
                "Last-Event-ID"
            )
            .allowCredentials(true)
            .maxAge(3600);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(mutationGuardInterceptor).addPathPatterns("/api/**");
    }
}
