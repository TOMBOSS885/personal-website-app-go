package com.personal.website.entity;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "live2d_settings")
public class Live2DSettings {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Boolean enabled = true;

    private String position = "bottom-right";

    private Integer size = 280;

    @Column(name = "primary_color")
    private String primaryColor = "rgba(96,165,250,0.92)";

    @Column(name = "transition_type")
    private String transitionType = "slide";

    @Column(name = "transition_duration")
    private Integer transitionDuration = 1500;

    @Column(name = "menu_align")
    private String menuAlign = "right";

    @Column(name = "show_sleep_button")
    private Boolean showSleepButton = true;

    @Column(name = "show_about_button")
    private Boolean showAboutButton = false;
}
