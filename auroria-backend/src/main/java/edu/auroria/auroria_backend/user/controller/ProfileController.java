package edu.auroria.auroria_backend.user.controller;

import edu.auroria.auroria_backend.user.dto.UpdateProfileRequest;
import edu.auroria.auroria_backend.user.entity.StudentProfile;
import edu.auroria.auroria_backend.user.entity.User;
import edu.auroria.auroria_backend.user.repository.UserRepository;
import edu.auroria.auroria_backend.user.service.StudentProfileService;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/profile")
@CrossOrigin(origins = "*")
public class ProfileController {

    private final StudentProfileService profileService;
    private final UserRepository userRepository;

    public ProfileController(
            StudentProfileService profileService,
            UserRepository userRepository
    ) {
        this.profileService = profileService;
        this.userRepository = userRepository;
    }

    @GetMapping("/{userId}")
    public ResponseEntity<Map<String, Object>> getProfile(
            @PathVariable Integer userId
    ) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User not found"
                ));

        StudentProfile profile = profileService.getProfile(userId);

        return ResponseEntity.ok(buildResponse(user, profile));
    }

    @PutMapping("/{userId}")
    public ResponseEntity<Map<String, Object>> updateProfile(
            @PathVariable Integer userId,
            @RequestBody UpdateProfileRequest request
    ) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User not found"
                ));

        if (request.fullName() != null) {
            user.setFullName(request.fullName());
        }

        if (request.phone() != null) {
            user.setPhone(request.phone());
        }

        userRepository.save(user);

        StudentProfile updatedData = new StudentProfile();

        updatedData.setDateOfBirth(request.dateOfBirth());
        updatedData.setNationality(request.nationality());
        updatedData.setStateOfOrigin(request.stateOfOrigin());
        updatedData.setEmergencyContact(request.emergencyContact());
        updatedData.setAddress(request.address());

        StudentProfile savedProfile =
                profileService.updateProfile(userId, updatedData);

        return ResponseEntity.ok(buildResponse(user, savedProfile));
    }

    private Map<String, Object> buildResponse(
            User user,
            StudentProfile profile
    ) {
        Map<String, Object> response = new LinkedHashMap<>();

        response.put("userId", user.getUserId());
        response.put("fullName", user.getFullName());
        response.put("email", user.getEmail());
        response.put("phone", user.getPhone());

        response.put("dateOfBirth", profile.getDateOfBirth());
        response.put("nationality", profile.getNationality());
        response.put("stateOfOrigin", profile.getStateOfOrigin());
        response.put("emergencyContact", profile.getEmergencyContact());
        response.put("address", profile.getAddress());

        return response;
    }
}