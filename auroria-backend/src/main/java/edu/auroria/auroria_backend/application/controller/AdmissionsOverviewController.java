package edu.auroria.auroria_backend.application.controller;

import edu.auroria.auroria_backend.application.dto.AdmissionsOverviewResponse;
import edu.auroria.auroria_backend.application.service.AdmissionsOverviewService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admissions")
public class AdmissionsOverviewController {

    private final AdmissionsOverviewService overviewService;

    public AdmissionsOverviewController(
            AdmissionsOverviewService overviewService
    ) {
        this.overviewService = overviewService;
    }

    @GetMapping("/overview")
    public AdmissionsOverviewResponse getOverview() {
        return overviewService.getOverview();
    }
}