package com.personal.website.repository;

import com.personal.website.entity.Live2DModel;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface Live2DModelRepository extends JpaRepository<Live2DModel, Long> {
    Optional<Live2DModel> findByActiveTrue();
    List<Live2DModel> findAllByOrderByCreatedAtDesc();
    List<Live2DModel> findAllBySwitchableTrueOrderByDisplayOrderAscCreatedAtDesc();
}
