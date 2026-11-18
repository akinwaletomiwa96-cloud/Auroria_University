package edu.auroria.auroria_backend.enquiry.service;

import edu.auroria.auroria_backend.enquiry.entity.Enquiry;

import edu.auroria.auroria_backend.enquiry.repository.EnquiryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EnquiryService {

    private final EnquiryRepository enquiryRepository;

    public EnquiryService(EnquiryRepository enquiryRepository) {
        this.enquiryRepository = enquiryRepository;
    }

    @Transactional
    public Enquiry submitEnquiry(Enquiry enquiry) {
        requireText(enquiry.getFullName(), "Full name");
        requireText(enquiry.getEmail(), "Email");
        requireText(enquiry.getPhoneNumber(), "Phone number");
        requireText(enquiry.getEnquiryTopic(), "Enquiry topic");
        requireText(enquiry.getSubject(), "Subject");
        requireText(enquiry.getMessage(), "Message");

        if (!enquiry.getEmail().matches(
                "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            throw new IllegalArgumentException(
                    "Enter a valid email address.");
        }

        if (!enquiry.getPhoneNumber().matches(
                "^[+0-9()\\- ]{7,25}$")) {
            throw new IllegalArgumentException(
                    "Enter a valid phone number.");
        }

        // Do not allow visitors to choose their own status or ID.
        enquiry.setEnquiryId(null);
        enquiry.setStatus("NEW");

        return enquiryRepository.save(enquiry);
    }

    private void requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(
                    field + " is required.");
        }
    }
}
