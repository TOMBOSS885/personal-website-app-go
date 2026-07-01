package com.personal.website.entity;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "feature_cards")
public class FeatureCard {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    private String titleEn;

    @Column(length = 500)
    private String description;

    @Column(length = 500)
    private String descriptionEn;

    private String icon = "Code";

    private String gradient = "from-blue-500 to-cyan-500";

    private Integer displayOrder = 0;

    private Boolean enabled = true;
}
