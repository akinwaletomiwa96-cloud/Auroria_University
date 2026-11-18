package edu.auroria.auroria_backend.user.controller;

import edu.auroria.auroria_backend.user.dto.AdminOverviewResponse;
import edu.auroria.auroria_backend.user.service.AdminOverviewService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
public class AdminOverviewController {

    private final AdminOverviewService overviewService;

    public AdminOverviewController(
            AdminOverviewService overviewService
    ) {
        this.overviewService = overviewService;
    }

    @GetMapping("/overview")
    public ResponseEntity<AdminOverviewResponse> getOverview() {
        return ResponseEntity.ok(overviewService.getOverview());
    }
}
