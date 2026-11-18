package edu.auroria.auroria_backend.enquiry.controller;


import edu.auroria.auroria_backend.enquiry.entity.Enquiry;
import edu.auroria.auroria_backend.enquiry.service.EnquiryService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/enquiries")
@CrossOrigin(origins = {
        "http://127.0.0.1:5501",
        "http://localhost:5501",
        "http://localhost:5500",
        "http://127.0.0.1:5500"
})
public class EnquiryController {

    private final EnquiryService enquiryService;

    public EnquiryController(EnquiryService enquiryService) {
        this.enquiryService = enquiryService;
    }

    @PostMapping
    public ResponseEntity<?> submitEnquiry(
            @RequestBody Enquiry enquiry) {
        try {
            Enquiry saved =
                    enquiryService.submitEnquiry(enquiry);

            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(Map.of(
                            "success", true,
                            "message",
                            "Your enquiry has been submitted successfully.",
                            "enquiryId", saved.getEnquiryId()
                    ));

        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "success", false,
                            "message", ex.getMessage()
                    ));
        }
    }
}
