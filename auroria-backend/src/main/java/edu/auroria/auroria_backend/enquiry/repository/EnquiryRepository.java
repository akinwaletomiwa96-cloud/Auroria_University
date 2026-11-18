
package edu.auroria.auroria_backend.enquiry.repository;

import edu.auroria.auroria_backend.enquiry.entity.Enquiry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EnquiryRepository
        extends JpaRepository<Enquiry, Integer> {

    long countByStatusIgnoreCase(String status);

    List<Enquiry> findTop5ByOrderByCreatedAtDesc();
}
