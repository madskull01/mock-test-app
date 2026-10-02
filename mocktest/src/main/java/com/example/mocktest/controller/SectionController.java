package com.example.mocktest.controller;

import com.example.mocktest.dto.section.CreateSectionRequest;
import com.example.mocktest.dto.section.SectionResponse;
import com.example.mocktest.dto.section.UpdateSectionRequest;
import com.example.mocktest.service.SectionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sections")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class SectionController {

    private final SectionService sectionService;

    @PostMapping
    public ResponseEntity<SectionResponse> createSection(
            @Valid @RequestBody CreateSectionRequest request) {

        SectionResponse response =
                sectionService.createSection(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    @GetMapping
    public ResponseEntity<List<SectionResponse>> getAllSections() {

        return ResponseEntity.ok(
                sectionService.getAllSections()
        );
    }

    @GetMapping("/active")
    public ResponseEntity<List<SectionResponse>>
    getActiveSections() {

        return ResponseEntity.ok(
                sectionService.getActiveSections()
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<SectionResponse> getSectionById(
            @PathVariable Long id) {

        return ResponseEntity.ok(
                sectionService.getSectionById(id)
        );
    }

    @PutMapping("/{id}")
    public ResponseEntity<SectionResponse> updateSection(
            @PathVariable Long id,
            @Valid @RequestBody UpdateSectionRequest request) {

        return ResponseEntity.ok(
                sectionService.updateSection(id, request)
        );
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSection(
            @PathVariable Long id) {

        sectionService.deleteSection(id);

        return ResponseEntity.noContent().build();
    }
}
