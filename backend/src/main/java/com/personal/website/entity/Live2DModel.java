package com.personal.website.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "live2d_models")
public class Live2DModel {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String directory;

    @Column(nullable = false, length = 1000)
    private String modelPath;

    @Column(nullable = false)
    private Boolean active = false;

    @Column(nullable = false)
    private Boolean switchable = true;

    @Column(name = "display_order")
    private Integer displayOrder = 0;

    private Double scale = 1.0;

    @Column(name = "offset_x")
    private Double offsetX = 0.0;

    @Column(name = "offset_y")
    private Double offsetY = 0.0;

    private Double volume = 0.0;

    @Column(name = "tips_enabled")
    private Boolean tipsEnabled = true;

    @Column(name = "welcome_messages", length = 2000)
    private String welcomeMessages = "Welcome back!";

    @Column(name = "tip_messages", length = 4000)
    private String tipMessages = "Take a short break.\nRemember to save your ideas.";

    @Column(name = "tip_duration")
    private Integer tipDuration = 3500;

    @Column(name = "tip_interval")
    private Integer tipInterval = 9000;

    @Column(name = "tip_offset_x")
    private Integer tipOffsetX = 0;

    @Column(name = "tip_offset_y")
    private Integer tipOffsetY = 0;

    @Column(name = "typing_enabled")
    private Boolean typingEnabled = false;

    @Column(name = "typing_param")
    private String typingParam = "PARAM_MOUTH_OPEN_Y";

    @Column(name = "typing_speed")
    private Integer typingSpeed = 120;

    @Column(name = "typing_min_value")
    private Double typingMinValue = 0.0;

    @Column(name = "typing_max_value")
    private Double typingMaxValue = 1.0;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
