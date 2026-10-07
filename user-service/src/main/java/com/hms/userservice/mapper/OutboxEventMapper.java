package com.hms.userservice.mapper;

import com.hms.userservice.domain.OutboxEvent;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface OutboxEventMapper {

    int insert(OutboxEvent event);

    List<OutboxEvent> findOldestNew(@Param("limit") int limit);

    int markSent(@Param("id") Long id);
}
