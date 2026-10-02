package com.example.mocktest.service;


import com.example.mocktest.dto.mocktest.CreateMockTestRequest;
import com.example.mocktest.dto.mocktest.MockTestResponse;
import com.example.mocktest.dto.mocktest.UpdateMockTestRequest;
import com.example.mocktest.model.MockTest;

import java.util.List;

public interface MockTestService {

    MockTestResponse createTest(
            CreateMockTestRequest request
    );

    MockTestResponse getTestById(Long id);

    List<MockTestResponse> getAllTests();

    List<MockTestResponse> getActiveTests();

    MockTestResponse updateTest(
            Long id,
            UpdateMockTestRequest request
    );

    void deleteTest(Long id);
}
