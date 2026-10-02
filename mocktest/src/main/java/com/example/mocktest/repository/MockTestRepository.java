package com.example.mocktest.repository;

import com.example.mocktest.model.MockTest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MockTestRepository extends JpaRepository<MockTest, Long> {

    List<MockTest> findByActiveTrue();

    boolean existsByTitle(String title);
}
