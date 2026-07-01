package com.personal.website.repository;

import com.personal.website.entity.FeatureCard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface FeatureCardRepository extends JpaRepository<FeatureCard, Long> {
    List<FeatureCard> findAllByOrderByDisplayOrderAsc();
    List<FeatureCard> findByEnabledTrueOrderByDisplayOrderAsc();
}
