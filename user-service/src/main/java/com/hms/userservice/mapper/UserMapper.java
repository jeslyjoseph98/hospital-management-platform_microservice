package com.hms.userservice.mapper;

import com.hms.userservice.domain.User;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.Optional;

@Mapper
public interface UserMapper {

    Optional<User> findByPhone(@Param("phone") String phone);

    Optional<User> findById(@Param("id") Long id);

    Optional<User> findByDoctorId(@Param("doctorId") Long doctorId);

    boolean existsByEmail(@Param("email") String email);

    int insert(User user);

    int updateLastLoginAt(@Param("id") Long id);

    int updateActiveByDoctorId(@Param("doctorId") Long doctorId, @Param("active") boolean active);
}
