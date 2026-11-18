package edu.auroria.auroria_backend.user.service;

import edu.auroria.auroria_backend.user.entity.StudentProfile;
import edu.auroria.auroria_backend.user.entity.User;
import edu.auroria.auroria_backend.user.repository.StudentProfileRepository;
import edu.auroria.auroria_backend.user.repository.UserRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StudentProfileService {

    private final StudentProfileRepository profileRepository;
    private final UserRepository userRepository;

    public StudentProfileService(
            StudentProfileRepository profileRepository,
            UserRepository userRepository
    ) {
        this.profileRepository = profileRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public StudentProfile getProfile(Integer userId) {

        return profileRepository.findByUser_UserId(userId)
                .orElseGet(() -> createEmptyProfile(userId));
    }

    @Transactional
    public StudentProfile updateProfile(
            Integer userId,
            StudentProfile updatedData
    ) {

        StudentProfile profile = profileRepository
                .findByUser_UserId(userId)
                .orElseGet(() -> createEmptyProfile(userId));

        profile.setDateOfBirth(updatedData.getDateOfBirth());
        profile.setAddress(updatedData.getAddress());
        profile.setNationality(updatedData.getNationality());
        profile.setStateOfOrigin(updatedData.getStateOfOrigin());
        profile.setEmergencyContact(updatedData.getEmergencyContact());

        return profileRepository.save(profile);
    }

    private StudentProfile createEmptyProfile(Integer userId) {

        User user = userRepository.findById(userId)
                .orElseThrow(() ->
                        new RuntimeException("User not found: " + userId)
                );

        StudentProfile profile = new StudentProfile();
        profile.setUser(user);

        return profileRepository.save(profile);
    }
}